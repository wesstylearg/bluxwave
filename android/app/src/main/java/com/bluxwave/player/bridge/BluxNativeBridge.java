package com.bluxwave.player.bridge;

import android.app.Activity;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import com.bluxwave.player.playback.PlaybackController;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * JavaScript interface injected into the WebView as `window.AndroidBridge`.
 * Provides seamless 2-way communication between BLUXWAVE Lite and the native Media3 player.
 */
public class BluxNativeBridge {
    private static final String TAG = "BluxNativeBridge";

    private final Activity activity;
    private final WebView webView;
    private final PlaybackController playbackController;
    private final Handler mainHandler;

    public BluxNativeBridge(@NonNull Activity activity, @NonNull WebView webView, @NonNull PlaybackController controller) {
        this.activity = activity;
        this.webView = webView;
        this.playbackController = controller;
        this.mainHandler = new Handler(Looper.getMainLooper());

        // Listen for native playback events to forward to the Web UI
        this.playbackController.setStateListener(new PlaybackController.PlaybackStateListener() {
            @Override
            public void onPlaybackStateChanged(boolean isPlaying, int playbackState) {
                notifyWebUi("stateChange", getPlaybackStateJson(isPlaying, playbackState));
            }

            @Override
            public void onMediaItemTransition(@Nullable MediaItem mediaItem) {
                notifyWebUi("trackChange", getTrackChangeJson(mediaItem));
            }

            @Override
            public void onPositionDiscontinuity(long positionMs, long durationMs) {
                try {
                    JSONObject json = new JSONObject();
                    json.put("currentTime", positionMs / 1000.0);
                    json.put("duration", durationMs / 1000.0);
                    notifyWebUi("timeUpdate", json.toString());
                } catch (Exception ignored) {}
            }

            @Override
            public void onCastSessionChanged(boolean isCastConnected, @Nullable String deviceName) {
                try {
                    JSONObject json = new JSONObject();
                    json.put("connected", isCastConnected);
                    json.put("deviceName", deviceName != null ? deviceName : "");
                    notifyWebUi("castChange", json.toString());
                } catch (Exception ignored) {}
            }
        });
    }

    @JavascriptInterface
    public boolean isNative() {
        return true;
    }

    @JavascriptInterface
    public void playTrack(String jsonTrackStr) {
        try {
            JSONObject track = new JSONObject(jsonTrackStr);
            mainHandler.post(() -> playbackController.playTrackJson(track, true));
        } catch (Exception e) {
            Log.e(TAG, "Error playing track JSON: " + e.getMessage());
        }
    }

    @JavascriptInterface
    public void pause() {
        mainHandler.post(playbackController::pause);
    }

    @JavascriptInterface
    public void resume() {
        mainHandler.post(playbackController::play);
    }

    @JavascriptInterface
    public void togglePlay() {
        mainHandler.post(() -> {
            Player p = playbackController.getActivePlayer();
            if (p.isPlaying()) {
                p.pause();
            } else {
                p.play();
            }
        });
    }

    @JavascriptInterface
    public void seekTo(long seconds) {
        mainHandler.post(() -> playbackController.seekTo(seconds * 1000));
    }

    @JavascriptInterface
    public void next() {
        mainHandler.post(playbackController::next);
    }

    @JavascriptInterface
    public void previous() {
        mainHandler.post(playbackController::previous);
    }

    @JavascriptInterface
    public void setQueue(String jsonArrayStr, int startIndex) {
        try {
            JSONArray array = new JSONArray(jsonArrayStr);
            mainHandler.post(() -> playbackController.setQueueFromJson(array, startIndex));
        } catch (Exception e) {
            Log.e(TAG, "Error setting queue JSON: " + e.getMessage());
        }
    }

    @JavascriptInterface
    public String getPlaybackState() {
        Player p = playbackController.getActivePlayer();
        return getPlaybackStateJson(p.isPlaying(), p.getPlaybackState());
    }

    @JavascriptInterface
    public boolean isCastConnected() {
        return playbackController.isCastActive();
    }

    @JavascriptInterface
    public String getConnectedCastDevice() {
        String name = playbackController.getConnectedCastDeviceName();
        return name != null ? name : "";
    }

    @JavascriptInterface
    public void disconnectCast() {
        mainHandler.post(playbackController::switchToLocal);
    }

    private String getPlaybackStateJson(boolean isPlaying, int playbackState) {
        try {
            Player p = playbackController.getActivePlayer();
            JSONObject json = new JSONObject();
            json.put("isPlaying", isPlaying);
            json.put("playbackState", playbackState);
            json.put("currentTime", p.getCurrentPosition() / 1000.0);
            json.put("duration", p.getDuration() > 0 ? p.getDuration() / 1000.0 : 0);
            json.put("isCast", playbackController.isCastActive());
            json.put("castDevice", playbackController.getConnectedCastDeviceName());
            return json.toString();
        } catch (Exception e) {
            return "{}";
        }
    }

    private String getTrackChangeJson(@Nullable MediaItem mediaItem) {
        try {
            JSONObject json = new JSONObject();
            if (mediaItem != null) {
                json.put("id", mediaItem.mediaId);
                if (mediaItem.mediaMetadata != null) {
                    json.put("title", mediaItem.mediaMetadata.title != null ? mediaItem.mediaMetadata.title.toString() : "");
                    json.put("artist", mediaItem.mediaMetadata.artist != null ? mediaItem.mediaMetadata.artist.toString() : "");
                    json.put("thumbnail", mediaItem.mediaMetadata.artworkUri != null ? mediaItem.mediaMetadata.artworkUri.toString() : "");
                }
            }
            return json.toString();
        } catch (Exception e) {
            return "{}";
        }
    }

    private void notifyWebUi(String eventName, String dataJson) {
        activity.runOnUiThread(() -> {
            String script = String.format(
                    "if (window.bluxNativeBridge && typeof window.bluxNativeBridge.onNativeEvent === 'function') {" +
                    "  window.bluxNativeBridge.onNativeEvent('%s', %s);" +
                    "}", eventName, dataJson
            );
            webView.evaluateJavascript(script, null);
        });
    }
}
