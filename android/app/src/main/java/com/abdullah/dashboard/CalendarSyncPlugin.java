package com.abdullah.dashboard;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.TimeZone;

@CapacitorPlugin(
    name = "CalendarSync",
    permissions = {
        @Permission(strings = { Manifest.permission.READ_CALENDAR }, alias = "read"),
        @Permission(strings = { Manifest.permission.WRITE_CALENDAR }, alias = "write")
    }
)
public class CalendarSyncPlugin extends Plugin {

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("read", getPermissionState("read") == PermissionState.GRANTED ? "granted" : "denied");
        ret.put("write", getPermissionState("write") == PermissionState.GRANTED ? "granted" : "denied");
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
        ret.put("write", getPermissionState("write") == PermissionState.GRANTED ? "granted" : "denied");
        call.resolve(ret);
    }

    @PluginMethod
    public void getCalendars(PluginCall call) {
        if (getPermissionState("read") != PermissionState.GRANTED) {
            call.reject("Calendar permission not granted");
            return;
        }
        try {
            ContentResolver cr = getContext().getContentResolver();
            String[] projection = new String[]{
                CalendarContract.Calendars._ID,
                CalendarContract.Calendars.NAME,
                CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
                CalendarContract.Calendars.ACCOUNT_NAME,
                CalendarContract.Calendars.ACCOUNT_TYPE,
                CalendarContract.Calendars.CALENDAR_COLOR
            };
            Cursor cursor = cr.query(CalendarContract.Calendars.CONTENT_URI, projection, null, null, null);
            JSArray calendars = new JSArray();
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    JSObject cal = new JSObject();
                    cal.put("id", cursor.getString(0));
                    cal.put("name", cursor.getString(2) != null ? cursor.getString(2) : cursor.getString(1));
                    cal.put("accountName", cursor.getString(3));
                    cal.put("accountType", cursor.getString(4));
                    cal.put("color", cursor.getInt(5));
                    calendars.put(cal);
                }
                cursor.close();
            }
            JSObject ret = new JSObject();
            ret.put("calendars", calendars);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error reading calendars: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getEvents(PluginCall call) {
        if (getPermissionState("read") != PermissionState.GRANTED) {
            call.reject("Calendar permission not granted");
            return;
        }
        long startMillis = call.getLong("startTime", System.currentTimeMillis() - 30L * 24 * 60 * 60 * 1000);
        long endMillis = call.getLong("endTime", System.currentTimeMillis() + 90L * 24 * 60 * 60 * 1000);

        try {
            ContentResolver cr = getContext().getContentResolver();
            String[] projection = new String[]{
                CalendarContract.Events._ID,
                CalendarContract.Events.TITLE,
                CalendarContract.Events.DESCRIPTION,
                CalendarContract.Events.EVENT_LOCATION,
                CalendarContract.Events.DTSTART,
                CalendarContract.Events.DTEND,
                CalendarContract.Events.ALL_DAY,
                CalendarContract.Events.CALENDAR_ID,
                CalendarContract.Events.EVENT_COLOR
            };
            String selection = "(" + CalendarContract.Events.DTSTART + " >= ? AND " +
                CalendarContract.Events.DTSTART + " <= ?)";
            String[] args = new String[]{ String.valueOf(startMillis), String.valueOf(endMillis) };

            Cursor cursor = cr.query(CalendarContract.Events.CONTENT_URI, projection, selection, args,
                CalendarContract.Events.DTSTART + " ASC");
            JSArray events = new JSArray();
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    JSObject event = new JSObject();
                    event.put("id", cursor.getString(0));
                    event.put("title", cursor.getString(1));
                    event.put("description", cursor.getString(2));
                    event.put("location", cursor.getString(3));
                    event.put("startTime", cursor.getLong(4));
                    event.put("endTime", cursor.getLong(5));
                    event.put("allDay", cursor.getInt(6) == 1);
                    event.put("calendarId", cursor.getString(7));
                    event.put("color", cursor.getInt(8));
                    events.put(event);
                }
                cursor.close();
            }
            JSObject ret = new JSObject();
            ret.put("events", events);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error reading events: " + e.getMessage());
        }
    }

    @PluginMethod
    public void createEvent(PluginCall call) {
        if (getPermissionState("write") != PermissionState.GRANTED) {
            call.reject("Calendar write permission not granted");
            return;
        }
        String title = call.getString("title", "");
        String description = call.getString("description", "");
        String location = call.getString("location", "");
        Long startTime = call.getLong("startTime", 0L);
        Long endTime = call.getLong("endTime", startTime);
        Boolean allDay = call.getBoolean("allDay", false);

        try {
            ContentValues values = new ContentValues();
            values.put(CalendarContract.Events.DTSTART, startTime);
            values.put(CalendarContract.Events.DTEND, endTime);
            values.put(CalendarContract.Events.TITLE, title);
            values.put(CalendarContract.Events.DESCRIPTION, description);
            values.put(CalendarContract.Events.EVENT_LOCATION, location);
            values.put(CalendarContract.Events.CALENDAR_ID, 1);
            values.put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().getID());
            values.put(CalendarContract.Events.ALL_DAY, allDay ? 1 : 0);
            Uri uri = getContext().getContentResolver().insert(CalendarContract.Events.CONTENT_URI, values);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("eventId", ContentUris.parseId(uri));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error creating event: " + e.getMessage());
        }
    }
}
