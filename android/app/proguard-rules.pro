# Keep Capacitor bridge
-keep class com.getcapacitor.** { *; }
-keep class pro.datascoop.sela.** { *; }

# Keep native plugins
-keep class pro.datascoop.sela.AppDrawerPlugin { *; }
-keep class pro.datascoop.sela.CalendarSyncPlugin { *; }
-keep class pro.datascoop.sela.CallLogSyncPlugin { *; }
-keep class pro.datascoop.sela.MainActivity { *; }

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
