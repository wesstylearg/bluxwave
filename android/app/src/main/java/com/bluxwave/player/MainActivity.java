package com.bluxwave.player;

import android.annotation.SuppressLint;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import com.bluxwave.player.bridge.BluxNativeBridge;
import com.bluxwave.player.playback.PlaybackService;

/**
 * Main Activity hosting the ultra-optimized BLUXWAVE Lite WebView UI,
 * bound to the native Media3 PlaybackService.
 */
public class MainActivity extends AppCompatActivity {
    private static final String TAG = "MainActivity";

    private WebView webView;
    private PlaybackService playbackService;
    private boolean isServiceBound = false;
    private BluxNativeBridge bridge;

    private final ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder binder) {
            PlaybackService.LocalBinder localBinder = (PlaybackService.LocalBinder) binder;
            playbackService = localBinder.getService();
            isServiceBound = true;

            // Wire bridge with active PlaybackController
            bridge = new BluxNativeBridge(MainActivity.this, webView, localBinder.getPlaybackController());
            webView.addJavascriptInterface(bridge, "AndroidBridge");

            // Signal to web app that native bridge is ready
            webView.post(() -> webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('blux:nativeReady'));", null
            ));
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            isServiceBound = false;
            playbackService = null;
        }
    };

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Dark navigation & status bar
        configureSystemBars();

        // 1. Start PlaybackService normally (Media3 will promote to foreground when playback begins)
        Intent serviceIntent = new Intent(this, PlaybackService.class);
        try {
            startService(serviceIntent);
        } catch (Throwable t) {
            android.util.Log.w(TAG, "startService caught: " + t.getMessage());
        }
        try {
            bindService(serviceIntent, serviceConnection, Context.BIND_AUTO_CREATE);
        } catch (Throwable t) {
            android.util.Log.w(TAG, "bindService caught: " + t.getMessage());
        }

        // 2. Setup WebView
        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0E0E12"));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false; // Stay inside WebView
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (isServiceBound) {
                    view.evaluateJavascript("window.dispatchEvent(new CustomEvent('blux:nativeReady'));", null);
                }
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                android.util.Log.e(TAG, "WebView error: " + description + " at " + failingUrl);
            }
        });

        // Load bundled BLUXWAVE Lite web application from assets root
        webView.loadUrl("file:///android_asset/index.html");
    }

    private void configureSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                // Dark background -> light text/icons
                controller.setSystemBarsAppearance(0, WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
                controller.setSystemBarsAppearance(0, WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
        }
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.parseColor("#0E0E12"));
    }

    @Override
    public void onBackPressed() {
        // Let web UI handle back if inside Focus Mode or open panels
        webView.evaluateJavascript(
                "(function() {" +
                "  if (window.bluxUI && window.bluxUI.isFocusOpen) { window.bluxUI.closeFocusMode(); return true; }" +
                "  if (window.bluxUI && window.bluxUI.isQueueOpen) { window.bluxUI.toggleQueue(false); return true; }" +
                "  return false;" +
                "})()",
                result -> {
                    if ("true".equals(result)) {
                        // Handled by web app
                        return;
                    }
                    if (webView.canGoBack()) {
                        webView.goBack();
                    } else {
                        super.onBackPressed();
                    }
                }
        );
    }

    @Override
    protected void onDestroy() {
        if (isServiceBound) {
            unbindService(serviceConnection);
            isServiceBound = false;
        }
        super.onDestroy();
    }
}
