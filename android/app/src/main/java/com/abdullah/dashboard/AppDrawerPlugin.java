package com.abdullah.dashboard;

import android.content.Intent;
import android.content.pm.ResolveInfo;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;

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
}
