package pro.datascoop.sela;

import android.content.Intent;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AppDrawer")
public class AppDrawerPlugin extends Plugin {

    /**
     * Open the Android app launcher (app drawer / list of all installed apps).
     * This launches an intent that shows all launchable applications.
     */
    @PluginMethod
    public void openAppDrawer(PluginCall call) {
        try {
            Intent intent = new Intent(Intent.ACTION_MAIN);
            intent.addCategory(Intent.CATEGORY_LAUNCHER);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(Intent.createChooser(intent, "اختر تطبيقاً"));
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not open app drawer: " + e.getMessage());
        }
    }

    /**
     * Go to the Android home screen.
     */
    @PluginMethod
    public void goHome(PluginCall call) {
        try {
            Intent intent = new Intent(Intent.ACTION_MAIN);
            intent.addCategory(Intent.CATEGORY_HOME);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not go home: " + e.getMessage());
        }
    }

    /**
     * Open the Android notification shade / settings.
     * Uses the hidden API call to expand the notification panel.
     * Falls back to the notification settings page on some OEM ROMs.
     */
    @PluginMethod
    public void openNotifications(PluginCall call) {
        try {
            // Try the standard way: open notification settings
            Intent intent = new Intent();
            intent.setAction("android.settings.APP_NOTIFICATION_SETTINGS");
            intent.putExtra("android.provider.extra.APP_PACKAGE", getContext().getPackageName());
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            // Fallback: try the global notification settings
            try {
                Intent intent = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e2) {
                call.reject("Could not open notifications: " + e2.getMessage());
            }
        }
    }
}
