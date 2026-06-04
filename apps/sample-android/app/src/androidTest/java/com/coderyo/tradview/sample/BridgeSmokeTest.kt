package com.coderyo.tradview.sample

import android.net.Uri
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Compile-time smoke for V2-PROD CI (no WebView server required). */
@RunWith(AndroidJUnit4::class)
class BridgeSmokeTest {
    @Test
    fun playgroundUrlUsesWorkspaceRoute() {
        assertEquals("http://10.0.2.2:5173/workspace.html", MainActivity.PLAYGROUND_URL)
    }

    @Test
    fun packageNameMatchesApplicationId() {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        assertEquals("com.coderyo.tradview.sample", ctx.packageName)
    }

    @Test
    fun urlAllowlistPermitsLocalWorkspace() {
        assertTrue(MainActivity.isAllowedPlaygroundUrl(Uri.parse(MainActivity.PLAYGROUND_URL)))
    }

    @Test
    fun urlAllowlistRejectsExternalHost() {
        assertFalse(
            MainActivity.isAllowedPlaygroundUrl(Uri.parse("https://evil.example/workspace.html")),
        )
    }
}