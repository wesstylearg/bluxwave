package com.bluxwave.player.playback;

import android.content.Context;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/**
 * Orchestrates native Media3 playback for BLUXWAVE Lite with background support,
 * Audio Focus management, and metadata synchronization.
 */
public class PlaybackController implements Player.Listener {
    private static final String TAG = "PlaybackController";

    public interface PlaybackStateListener {
        void onPlaybackStateChanged(boolean isPlaying, int playbackState);
        void onMediaItemTransition(@Nullable MediaItem mediaItem);
        void onPositionDiscontinuity(long positionMs, long durationMs);
        void onCastSessionChanged(boolean isCastConnected, @Nullable String deviceName);
    }

    private final Context context;
    private final Handler mainHandler;
    private final AudioStreamResolver streamResolver;
    private final ExoPlayer exoPlayer;

    private boolean isCastActive = false;
    private String connectedCastDeviceName = null;

    private final List<MediaItem> currentPlaylist = new ArrayList<>();
    private final List<JSONObject> rawPlaylistTracks = new ArrayList<>();
    private int currentMediaItemIndex = 0;

    @Nullable private PlaybackStateListener stateListener;

    public PlaybackController(@NonNull Context context) {
        this.context = context.getApplicationContext();
        this.mainHandler = new Handler(Looper.getMainLooper());
        this.streamResolver = new AudioStreamResolver();

        // 1. Initialize local ExoPlayer with proper audio attributes & focus
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .setUsage(C.USAGE_MEDIA)
                .build();

        this.exoPlayer = new ExoPlayer.Builder(this.context)
                .setAudioAttributes(audioAttributes, true) // automatic audio focus management
                .setHandleAudioBecomingNoisy(true)        // pause on headphone disconnect
                .setWakeMode(C.WAKE_MODE_LOCAL)           // keep CPU awake during playback
                .build();

        this.exoPlayer.addListener(this);
    }

    public void setStateListener(@Nullable PlaybackStateListener listener) {
        this.stateListener = listener;
    }

    public Player getActivePlayer() {
        return exoPlayer;
    }

    public ExoPlayer getExoPlayer() {
        return exoPlayer;
    }

    public boolean isCastActive() {
        return isCastActive;
    }

    @Nullable
    public String getConnectedCastDeviceName() {
        return connectedCastDeviceName;
    }

    public void setCastDevice(boolean connected, @Nullable String deviceName) {
        this.isCastActive = connected;
        this.connectedCastDeviceName = deviceName;
        if (connected) {
            exoPlayer.pause();
        }
        if (stateListener != null) {
            stateListener.onCastSessionChanged(connected, deviceName);
        }
    }

    public void switchToLocal() {
        setCastDevice(false, null);
    }

    /**
     * Plays a track from a JSON track representation passed from BLUXWAVE Lite.
     */
    public void playTrackJson(@NonNull JSONObject track, boolean autoPlay) {
        final String videoId = track.optString("id", "");
        final String title = track.optString("title", "Canción");
        final String artist = track.optString("artist", "Artista");
        final String thumbnail = track.optString("thumbnail", "");

        // Resolve audio stream asynchronously without blocking UI
        streamResolver.resolveAudioStream(videoId, new AudioStreamResolver.StreamCallback() {
            @Override
            public void onSuccess(String streamUrl) {
                mainHandler.post(() -> {
                    MediaMetadata metadata = new MediaMetadata.Builder()
                            .setTitle(title)
                            .setArtist(artist)
                            .setArtworkUri(thumbnail.isEmpty() ? null : Uri.parse(thumbnail))
                            .build();

                    MediaItem mediaItem = new MediaItem.Builder()
                            .setMediaId(videoId)
                            .setUri(Uri.parse(streamUrl))
                            .setMediaMetadata(metadata)
                            .build();

                    currentPlaylist.clear();
                    currentPlaylist.add(mediaItem);
                    rawPlaylistTracks.clear();
                    rawPlaylistTracks.add(track);

                    exoPlayer.setMediaItem(mediaItem);
                    exoPlayer.prepare();
                    if (autoPlay) {
                        exoPlayer.play();
                    }

                    if (stateListener != null) {
                        stateListener.onMediaItemTransition(mediaItem);
                    }
                });
            }

            @Override
            public void onError(Exception e) {
                Log.e(TAG, "Failed to resolve stream for track: " + videoId, e);
            }
        });
    }

    /**
     * Sets the entire playback queue from JSON.
     */
    public void setQueueFromJson(@NonNull JSONArray tracks, int startIndex) {
        if (tracks.length() == 0) return;

        rawPlaylistTracks.clear();
        for (int i = 0; i < tracks.length(); i++) {
            JSONObject t = tracks.optJSONObject(i);
            if (t != null) rawPlaylistTracks.add(t);
        }

        currentMediaItemIndex = Math.max(0, Math.min(startIndex, rawPlaylistTracks.size() - 1));
        if (currentMediaItemIndex < rawPlaylistTracks.size()) {
            playTrackJson(rawPlaylistTracks.get(currentMediaItemIndex), true);
        }
    }

    public void play() {
        exoPlayer.play();
    }

    public void pause() {
        exoPlayer.pause();
    }

    public void seekTo(long positionMs) {
        exoPlayer.seekTo(positionMs);
    }

    public void next() {
        if (exoPlayer.hasNextMediaItem()) {
            exoPlayer.seekToNextMediaItem();
        } else if (currentMediaItemIndex + 1 < rawPlaylistTracks.size()) {
            currentMediaItemIndex++;
            playTrackJson(rawPlaylistTracks.get(currentMediaItemIndex), true);
        }
    }

    public void previous() {
        if (exoPlayer.getCurrentPosition() > 3000) {
            exoPlayer.seekTo(0);
        } else if (exoPlayer.hasPreviousMediaItem()) {
            exoPlayer.seekToPreviousMediaItem();
        } else if (currentMediaItemIndex - 1 >= 0) {
            currentMediaItemIndex--;
            playTrackJson(rawPlaylistTracks.get(currentMediaItemIndex), true);
        }
    }

    public void release() {
        exoPlayer.release();
    }

    // --- Player.Listener implementation ---

    @Override
    public void onPlaybackStateChanged(int playbackState) {
        if (stateListener != null) {
            stateListener.onPlaybackStateChanged(exoPlayer.isPlaying(), playbackState);
        }
    }

    @Override
    public void onIsPlayingChanged(boolean isPlaying) {
        if (stateListener != null) {
            stateListener.onPlaybackStateChanged(isPlaying, exoPlayer.getPlaybackState());
        }
    }

    @Override
    public void onMediaItemTransition(@Nullable MediaItem mediaItem, int reason) {
        if (stateListener != null) {
            stateListener.onMediaItemTransition(mediaItem);
        }
    }

    @Override
    public void onPositionDiscontinuity(@NonNull Player.PositionInfo oldPosition, @NonNull Player.PositionInfo newPosition, int reason) {
        if (stateListener != null) {
            stateListener.onPositionDiscontinuity(newPosition.positionMs, exoPlayer.getDuration());
        }
    }

    @Override
    public void onPlayerError(@NonNull PlaybackException error) {
        Log.e(TAG, "Player error code=" + error.errorCode + ": " + error.getMessage());
    }
}
