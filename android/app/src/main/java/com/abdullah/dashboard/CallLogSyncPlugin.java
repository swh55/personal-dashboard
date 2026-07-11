package com.abdullah.dashboard;

import android.Manifest;
import android.content.ContentResolver;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.provider.CallLog;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "CallLogSync",
    permissions = {
        @Permission(strings = { Manifest.permission.READ_CALL_LOG }, alias = "read")
    }
)
public class CallLogSyncPlugin extends Plugin {

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("read", getPermissionState("read") == PermissionState.GRANTED ? "granted" : "denied");
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        requestPermissionForAlias("read", call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("read", getPermissionState("read") == PermissionState.GRANTED ? "granted" : "denied");
        call.resolve(ret);
    }

    @PluginMethod
    public void getCallLogs(PluginCall call) {
        if (getPermissionState("read") != PermissionState.GRANTED) {
            call.reject("Call log permission not granted");
            return;
        }
        int limit = call.getInt("limit", 100);

        try {
            ContentResolver cr = getContext().getContentResolver();
            String[] projection = new String[]{
                CallLog.Calls._ID,
                CallLog.Calls.NUMBER,
                CallLog.Calls.CACHED_NAME,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION,
                CallLog.Calls.TYPE
            };
            Cursor cursor = cr.query(CallLog.Calls.CONTENT_URI, projection, null, null,
                CallLog.Calls.DATE + " DESC LIMIT " + limit);
            JSArray logs = new JSArray();
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    JSObject log = new JSObject();
                    log.put("id", cursor.getString(0));
                    log.put("number", cursor.getString(1));
                    log.put("name", cursor.getString(2));
                    log.put("date", cursor.getLong(3));
                    log.put("duration", cursor.getLong(4));
                    int type = cursor.getInt(5);
                    String direction;
                    String callType;
                    switch (type) {
                        case CallLog.Calls.INCOMING_TYPE:
                            direction = "incoming";
                            callType = "call";
                            break;
                        case CallLog.Calls.OUTGOING_TYPE:
                            direction = "outgoing";
                            callType = "call";
                            break;
                        case CallLog.Calls.MISSED_TYPE:
                            direction = "missed";
                            callType = "call";
                            break;
                        default:
                            direction = "unknown";
                            callType = "call";
                            break;
                    }
                    log.put("direction", direction);
                    log.put("type", callType);
                    logs.put(log);
                }
                cursor.close();
            }
            JSObject ret = new JSObject();
            ret.put("logs", logs);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error reading call logs: " + e.getMessage());
        }
    }
}
