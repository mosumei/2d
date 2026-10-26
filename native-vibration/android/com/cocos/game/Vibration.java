// 构建 Android 后：
// 1. 把本文件复制到 native/engine/android/app/src/com/cocos/game/Vibration.java
// 2. 在 AndroidManifest.xml 的 manifest 内加入：
//    <uses-permission android:name="android.permission.VIBRATE"/>

package com.cocos.game;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;

import com.cocos.lib.GlobalObject;

public final class Vibration {

    private Vibration() {
    }

    public static void vibrate(String type) {
        Context context = GlobalObject.getContext();
        if (context == null) {
            return;
        }

        Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) {
            return;
        }

        int duration = 15;
        int amplitude = 80;
        if ("heavy".equals(type)) {
            duration = 60;
            amplitude = 255;
        } else if ("medium".equals(type)) {
            duration = 35;
            amplitude = 160;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(duration, amplitude));
        } else {
            vibrator.vibrate(duration);
        }
    }
}
