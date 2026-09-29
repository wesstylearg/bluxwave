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
import androidx.media3.common.Timeline;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.cast.CastPlayer;
import com.google.android.gms.cast.framework.CastContext;
import com.google.android.gms.cast.framework.CastSession;
import com.google.android.gms.cast.framework.SessionManager;
import com.google.android.gms.cast.framework.SessionManagerListener;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executors;

/**
 * Orchestrates playback switching seamlessly between local ExoPlayer and remote CastPlayer.
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
    @Nullable private CastPlayer castPlayer;
    @Nullable private SessionManager castSessionManager;

    private Player activePlayer;
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

        // 1. Initialize local ExoPlayer
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
        this.activePlayer = this.exoPlayer;

        // 2. Initialize Google Cast integration if available
        initCast();
    }

    private void initCast() {
        mainHandler.post(() -> {
            try {
                // Verify Google Play Services is present before attempting to initialize Cast
                GoogleApiAvailability apiAvailability = GoogleApiAvailability.getInstance();
                int resultCode = apiAvailability.isGooglePlayServicesAvailable(context);
                if (resultCode != ConnectionResult.SUCCESS) {
                    Log.w(TAG, "Google Play Services not available for Cast (code " + resultCode + ")");
                    return;
                }

                CastContext.getSharedInstance(context, Executors.newSingleThreadExecutor())
                        .addOnSuccessListener(castContext -> {
                            try {
                                this.castSessionManager = castContext.getSessionManager();
                                this.castPlayer = new CastPlayer(castContext);
                                this.castPlayer.addListener(new Player.Listener() {
                                    @Override
                                    public void onPlaybackStateChanged(int playbackState) {
                                        if (isCastActive) {
                                            PlaybackController.this.onPlaybackStateChanged(playbackState);
                                        }
                                    }

                                    @Override
                                    public void onIsPlayingChanged(boolean isPlaying) {
                                        if (isCastActive) {
                                            PlaybackController.this.onIsPlayingChanged(isPlaying);
                                        }
                                    }

                                    @Override
                                    public void onMediaItemTransition(@Nullable MediaItem mediaItem, int reason) {
                                        if (isCastActive) {
                                            PlaybackController.this.onMediaItemTransition(mediaItem, reason);
                                        }
                                    }
                                });

                                this.castSessionManager.addSessionManagerListener(new SessionManagerListener<CastSession>() {
                                    @Override
                                    public void onSessionStarted(@NonNull CastSession session, @NonNull String sessionId) {
                                        connectedCastDeviceName = session.getCastDevice() != null ? session.getCastDevice().getFriendlyName() : "Google Cast";
                                        switchToCast();
                                    }

                                    @Override
                                    public void onSessionResumed(@NonNull CastSession session, boolean wasSuspended) {
                                        connectedCastDeviceName = session.getCastDevice() != null ? session.getCastDevice().getFriendlyName() : "Google Cast";
                                        switchToCast();
                                    }

                                    @Override
                                    public void onSessionEnded(@NonNull CastSession session, int error) {
                                        connectedCastDeviceName = null;
                                        switchToLocal();
                                    }

                                    @Override
                                    public void onSessionResumeFailed(@NonNull CastSession session, int error) {
                                        connectedCastDeviceName = null;
                                        switchToLocal();
                                    }

                                    @Override
                                    public void onSessionStartFailed(@NonNull CastSession session, int error) {
                                        connectedCastDeviceName = null;
                                        switchToLocal();
                                    }

                                    @Override public void onSessionStarting(@NonNull CastSession session) {}
                                    @Override public void onSessionEnding(@NonNull CastSession session) {}
                                    @Override public void onSessionResuming(@NonNull CastSession session, @NonNull String sessionId) {}
                                    @Override public void onSessionSuspended(@NonNull CastSession session, int reason) {}
                                }, CastSession.class);

                                Log.i(TAG, "CastContext & CastPlayer initialized asynchronously");
                            } catch (Throwable t) {
                                Log.w(TAG, "Failed setting up Cast session listener: " + t.getMessage());
                            }
                        })
                        .addOnFailureListener(e -> {
                            Log.w(TAG, "CastContext async initialization failed: " + e.getMessage());
                        });

            } catch (Throwable t) {
                Log.w(TAG, "CastContext not available on this device: " + t.getMessage());
            }
        });
    }

    public void setStateListener(@Nullable PlaybackStateListener listener) {
        this.stateListener = listener;
    }

    public Player getActivePlayer() {
        return activePlayer;
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

    /**
     * Switch playback to Google Cast receiver.
     */
    public void switchToCast() {
        if (castPlayer == null || isCastActive) return;

        long currentPosition = activePlayer.getCurrentPosition();
        int currentIndex = activePlayer.getCurrentMediaItemIndex();
        boolean wasPlaying = activePlayer.isPlaying();

        // Pause local playback
        exoPlayer.pause();

        isCastActive = true;
        activePlayer = castPlayer;

        // Transfer current playlist to CastPlayer
        if (!currentPlaylist.isEmpty()) {
            castPlayer.setMediaItems(currentPlaylist, currentIndex, currentPosition);
            castPlayer.prepare();
            if (wasPlaying) {
                castPlayer.play();
            }
        }

        if (stateListener != null) {
            stateListener.onCastSessionChanged(true, connectedCastDeviceName);
        }
        Log.i(TAG, "Switched to CastPlayer on " + connectedCastDeviceName);
    }

    /**
     * Switch playback back to local ExoPlayer on phone.
     */
    public void switchToLocal() {
        if (!isCastActive) return;

        long currentPosition = activePlayer.getCurrentPosition();
        int currentIndex = activePlayer.getCurrentMediaItemIndex();
        boolean wasPlaying = activePlayer.isPlaying();

        if (castPlayer != null) {
            castPlayer.pause();
        }

        isCastActive = false;
        activePlayer = exoPlayer;

        // Restore playlist and position to ExoPlayer
        if (!currentPlaylist.isEmpty() && currentIndex < currentPlaylist.size()) {
            exoPlayer.seekTo(currentIndex, currentPosition);
            if (wasPlaying) {
                exoPlayer.play();
            }
        }

        if (stateListener != null) {
            stateListener.onCastSessionChanged(false, null);
        }
        Log.i(TAG, "Switched back to local ExoPlayer");
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

                    activePlayer.setMediaItem(mediaItem);
                    activePlayer.prepare();
                    if (autoPlay) {
                        activePlayer.play();
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
        activePlayer.play();
    }

    public void pause() {
        activePlayer.pause();
    }

    public void seekTo(long positionMs) {
        activePlayer.seekTo(positionMs);
    }

    public void next() {
        if (activePlayer.hasNextMediaItem()) {
            activePlayer.seekToNextMediaItem();
        } else if (currentMediaItemIndex + 1 < rawPlaylistTracks.size()) {
            currentMediaItemIndex++;
            playTrackJson(rawPlaylistTracks.get(currentMediaItemIndex), true);
        }
    }

    public void previous() {
        if (activePlayer.getCurrentPosition() > 3000) {
            activePlayer.seekTo(0);
        } else if (activePlayer.hasPreviousMediaItem()) {
            activePlayer.seekToPreviousMediaItem();
        } else if (currentMediaItemIndex - 1 >= 0) {
            currentMediaItemIndex--;
            playTrackJson(rawPlaylistTracks.get(currentMediaItemIndex), true);
        }
    }

    public void release() {
        exoPlayer.release();
        if (castPlayer != null) {
            castPlayer.release();
        }
    }

    // --- Player.Listener implementation ---

    @Override
    public void onPlaybackStateChanged(int playbackState) {
        if (stateListener != null) {
            stateListener.onPlaybackStateChanged(activePlayer.isPlaying(), playbackState);
        }
    }

    @Override
    public void onIsPlayingChanged(boolean isPlaying) {
        if (stateListener != null) {
            stateListener.onPlaybackStateChanged(isPlaying, activePlayer.getPlaybackState());
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
            stateListener.onPositionDiscontinuity(newPosition.positionMs, activePlayer.getDuration());
        }
    }

    @Override
    public void onPlayerError(@NonNull PlaybackException error) {
        Log.e(TAG, "Player error code=" + error.errorCode + ": " + error.getMessage());
    }
}
