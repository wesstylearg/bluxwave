package com.bluxwave.player.playback;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import com.bluxwave.player.MainActivity;
import com.bluxwave.player.R;

/**
 * Native MediaSessionService powering background playback, lock screen controls,
 * Bluetooth integration, and seamless local ↔ Cast handoff.
 */
public class PlaybackService extends MediaSessionService {
    private static final String TAG = "PlaybackService";
    private static final String CHANNEL_ID = "bluxwave_playback_channel";
    private static final int NOTIFICATION_ID = 1001;

    private MediaSession mediaSession;
    private PlaybackController playbackController;

    private final IBinder binder = new LocalBinder();

    public class LocalBinder extends Binder {
        public PlaybackService getService() {
            return PlaybackService.this;
        }

        public PlaybackController getPlaybackController() {
            return playbackController;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "Creating PlaybackService with Media3 & ExoPlayer");

        createNotificationChannel();

        // 1. Initialize playback controller
        playbackController = new PlaybackController(this);

        // 2. Build Activity PendingIntent for notification clicks
        Intent sessionIntent = new Intent(this, MainActivity.class);
        sessionIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                sessionIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        // 3. Create MediaSession
        mediaSession = new MediaSession.Builder(this, playbackController.getActivePlayer())
                .setSessionActivity(pendingIntent)
                .build();

        // 4. Update session when switching between ExoPlayer and CastPlayer
        playbackController.setStateListener(new PlaybackController.PlaybackStateListener() {
            @Override
            public void onPlaybackStateChanged(boolean isPlaying, int playbackState) {
                // Ensure notification and foreground service stay updated
                updateForegroundNotification();
            }

            @Override
            public void onMediaItemTransition(@Nullable MediaItem mediaItem) {
                updateForegroundNotification();
            }

            @Override
            public void onPositionDiscontinuity(long positionMs, long durationMs) {}

            @Override
            public void onCastSessionChanged(boolean isCastConnected, @Nullable String deviceName) {
                // Switch session's underlying player
                mediaSession.setPlayer(playbackController.getActivePlayer());
            }
        });
    }

    @Nullable
    @Override
    public MediaSession onGetSession(@NonNull MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        // Handle MediaSessionService binding or local in-process binding
        if (intent != null && "androidx.media3.session.MediaSessionService".equals(intent.getAction())) {
            return super.onBind(intent);
        }
        return binder;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        super.onStartCommand(intent, flags, startId);
        return START_STICKY;
    }

    /**
     * Keep playing in background when user dismisses the Activity from recents
     * if the audio is currently playing.
     */
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Player player = playbackController.getActivePlayer();
        if (player == null || !player.getPlayWhenReady() || player.getPlaybackState() == Player.STATE_IDLE || player.getPlaybackState() == Player.STATE_ENDED) {
            stopSelf();
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Reproducción de BLUXWAVE",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Controles de música en segundo plano y pantalla bloqueada");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    private void updateForegroundNotification() {
        try {
            Player player = playbackController.getActivePlayer();
            if (player == null) return;

            MediaItem currentItem = player.getCurrentMediaItem();
            String title = "BLUXWAVE Lite";
            String artist = "Música";
            if (currentItem != null && currentItem.mediaMetadata != null) {
                if (currentItem.mediaMetadata.title != null) {
                    title = currentItem.mediaMetadata.title.toString();
                }
                if (currentItem.mediaMetadata.artist != null) {
                    artist = currentItem.mediaMetadata.artist.toString();
                }
            }

            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title)
                    .setContentText(artist)
                    .setSubText(playbackController.isCastActive() ? "Transmitiendo a " + playbackController.getConnectedCastDeviceName() : "BLUXWAVE")
                    .setOngoing(player.isPlaying())
                    .setPriority(NotificationCompat.PRIORITY_LOW)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

            Notification notification = builder.build();

            if (player.isPlaying()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
                } else {
                    startForeground(NOTIFICATION_ID, notification);
                }
            } else {
                // Keep notification but allow dismissal if paused
                stopForeground(false);
                NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                if (nm != null) {
                    nm.notify(NOTIFICATION_ID, notification);
                }
            }
        } catch (Throwable t) {
            Log.w(TAG, "updateForegroundNotification caught: " + t.getMessage());
        }
    }

    @Override
    public void onDestroy() {
        Log.i(TAG, "Destroying PlaybackService");
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        if (playbackController != null) {
            playbackController.release();
            playbackController = null;
        }
        super.onDestroy();
    }
}
