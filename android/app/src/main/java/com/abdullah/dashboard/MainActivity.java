package com.abdullah.dashboard;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppDrawerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
