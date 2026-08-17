# Keep Capacitor bridge
-keep class com.getcapacitor.** { *; }
-keep class com.abdullah.dashboard.** { *; }

# Keep native plugins
-keep class com.abdullah.dashboard.AppDrawerPlugin { *; }
-keep class com.abdullah.dashboard.CalendarSyncPlugin { *; }
-keep class com.abdullah.dashboard.CallLogSyncPlugin { *; }
-keep class com.abdullah.dashboard.MainActivity { *; }

# Keep model classes (used by JSON serialization)
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Standard Android rules
-dontwarn android.webkit.**
-keep class android.webkit.WebView { *; }
-keep class android.webkit.WebSettings { *; }

# Keep all Capacitor plugin registrations
-keep class * extends com.getcapacitor.Plugin { *; }
