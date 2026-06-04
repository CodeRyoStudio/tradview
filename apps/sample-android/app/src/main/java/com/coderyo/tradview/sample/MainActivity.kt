package com.coderyo.tradview.sample

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

/**
 * Bridge schema 3 WebView smoke shell (V2-PROD).
 * Loads playground workspace demo when [PLAYGROUND_URL] is reachable.
 */
class MainActivity : AppCompatActivity() {
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url ?: return true
                return !isAllowedPlaygroundUrl(url)
            }
        }
        setContentView(webView)
        webView.loadUrl(PLAYGROUND_URL)
    }

    companion object {
        /** Emulator → host dev server (`pnpm dev:playground`). Use HTTPS in production. */
        const val PLAYGROUND_URL = "http://10.0.2.2:5173/workspace.html"

        private val ALLOWED_HOSTS = setOf("10.0.2.2", "127.0.0.1", "localhost")

        fun isAllowedPlaygroundUrl(uri: Uri): Boolean {
            val host = uri.host ?: return false
            if (host !in ALLOWED_HOSTS) return false
            val path = uri.path ?: return false
            return path.endsWith("workspace.html") || path.endsWith("multi-chart.html") || path == "/"
        }
    }
}