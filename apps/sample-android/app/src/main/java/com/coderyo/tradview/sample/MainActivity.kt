package com.coderyo.tradview.sample

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

/**
 * Bridge schema 3 WebView smoke shell (V2-PROD @ GA).
 * Loads playground workspace demo when [PLAYGROUND_URL] is reachable.
 */
class MainActivity : AppCompatActivity() {
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.webViewClient = WebViewClient()
        setContentView(webView)
        webView.loadUrl(PLAYGROUND_URL)
    }

    companion object {
        /** Point device/emulator at local playground (`pnpm dev:playground`). */
        const val PLAYGROUND_URL = "http://10.0.2.2:5173/workspace.html"
    }
}