// 构建 iOS 后：
// 1. 把本文件复制到 native/engine/ios/Vibration.mm
// 2. 在该目录 CMakeLists.txt 的 AppDelegate.mm 下一行加入：
//    ${CC_PROJECT_DIR}/Vibration.mm

#import <UIKit/UIKit.h>

@interface Vibration : NSObject
+ (void)vibrate:(NSString *)type;
@end

@implementation Vibration

+ (void)vibrate:(NSString *)type {
    dispatch_async(dispatch_get_main_queue(), ^{
        UIImpactFeedbackStyle style = UIImpactFeedbackStyleLight;
        if (@available(iOS 13.0, *)) {
            if ([type isEqualToString:@"heavy"]) {
                style = UIImpactFeedbackStyleHeavy;
            } else if ([type isEqualToString:@"medium"]) {
                style = UIImpactFeedbackStyleMedium;
            }
        } else if ([type isEqualToString:@"heavy"] || [type isEqualToString:@"medium"]) {
            style = UIImpactFeedbackStyleHeavy;
        }

        UIImpactFeedbackGenerator *generator =
            [[UIImpactFeedbackGenerator alloc] initWithStyle:style];
        [generator prepare];
        [generator impactOccurred];
    });
}

@end
