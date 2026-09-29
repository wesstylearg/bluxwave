package com.bluxwave.player.playback;

import android.net.Uri;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Resolves YouTube video IDs into direct audio stream URLs (m4a/opus/aac) for ExoPlayer.
 */
public class AudioStreamResolver {
    private static final String TAG = "AudioStreamResolver";

    private static final String[] RESOLVER_APIS = {
        "https://api.piped.private.coffee/streams/",
        "https://pipedapi.kavin.rocks/streams/",
        "https://invidious.nerdvpn.de/api/v1/videos/"
    };

    private final OkHttpClient httpClient;
    private final ConcurrentHashMap<String, String> streamCache = new ConcurrentHashMap<>();

    public interface StreamCallback {
        void onSuccess(String streamUrl);
        void onError(Exception e);
    }

    public AudioStreamResolver() {
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(5, TimeUnit.SECONDS)
                .readTimeout(8, TimeUnit.SECONDS)
                .followRedirects(true)
                .build();
    }

    /**
     * Extracts YouTube ID if string is a full URL or returns raw ID.
     */
    public static String cleanVideoId(String input) {
        if (input == null) return "";
        String trimmed = input.trim();
        if (trimmed.contains("v=")) {
            String[] parts = trimmed.split("v=");
            if (parts.length > 1) {
                return parts[1].split("&")[0];
            }
        }
        if (trimmed.contains("youtu.be/")) {
            String[] parts = trimmed.split("youtu.be/");
            if (parts.length > 1) {
                return parts[1].split("\\?")[0];
            }
        }
        return trimmed;
    }

    /**
     * Resolves a video ID to a direct audio stream URL.
     */
    public void resolveAudioStream(@NonNull String videoIdOrUrl, @NonNull StreamCallback callback) {
        final String videoId = cleanVideoId(videoIdOrUrl);

        // Check cache first
        String cached = streamCache.get(videoId);
        if (cached != null) {
            callback.onSuccess(cached);
            return;
        }

        // Try resolvers sequentially
        tryResolveWithApi(videoId, 0, callback);
    }

    private void tryResolveWithApi(String videoId, int apiIndex, StreamCallback callback) {
        if (apiIndex >= RESOLVER_APIS.length) {
            // Fallback: direct cobalt/invidious stream link
            String fallbackUrl = "https://invidious.nerdvpn.de/latest_version?id=" + videoId + "&itag=140";
            streamCache.put(videoId, fallbackUrl);
            callback.onSuccess(fallbackUrl);
            return;
        }

        String apiUrl = RESOLVER_APIS[apiIndex] + videoId;
        Request request = new Request.Builder()
                .url(apiUrl)
                .header("User-Agent", "BluxWave/1.0 (Android Native Player)")
                .build();

        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                Log.w(TAG, "Resolver " + apiUrl + " failed: " + e.getMessage());
                tryResolveWithApi(videoId, apiIndex + 1, callback);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try {
                    if (!response.isSuccessful() || response.body() == null) {
                        tryResolveWithApi(videoId, apiIndex + 1, callback);
                        return;
                    }

                    String body = response.body().string();
                    JSONObject json = new JSONObject(body);

                    String audioUrl = null;

                    // Piped response format: audioStreams array
                    if (json.has("audioStreams")) {
                        JSONArray audioStreams = json.getJSONArray("audioStreams");
                        // Pick best bitrate audio
                        for (int i = 0; i < audioStreams.length(); i++) {
                            JSONObject stream = audioStreams.getJSONObject(i);
                            if (stream.has("url")) {
                                audioUrl = stream.getString("url");
                                // Prefer m4a if available for ExoPlayer hardware decoders
                                String mimeType = stream.optString("mimeType", "");
                                if (mimeType.contains("mp4") || mimeType.contains("m4a")) {
                                    break;
                                }
                            }
                        }
                    } else if (json.has("adaptiveFormats")) {
                        // Invidious format: adaptiveFormats array
                        JSONArray formats = json.getJSONArray("adaptiveFormats");
                        for (int i = 0; i < formats.length(); i++) {
                            JSONObject fmt = formats.getJSONObject(i);
                            String type = fmt.optString("type", "");
                            if (type.startsWith("audio/") && fmt.has("url")) {
                                audioUrl = fmt.getString("url");
                                if (type.contains("mp4") || type.contains("m4a")) {
                                    break;
                                }
                            }
                        }
                    }

                    if (audioUrl != null && !audioUrl.isEmpty()) {
                        streamCache.put(videoId, audioUrl);
                        callback.onSuccess(audioUrl);
                    } else {
                        tryResolveWithApi(videoId, apiIndex + 1, callback);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Error parsing stream response: " + e.getMessage());
                    tryResolveWithApi(videoId, apiIndex + 1, callback);
                } finally {
                    response.close();
                }
            }
        });
    }
}
