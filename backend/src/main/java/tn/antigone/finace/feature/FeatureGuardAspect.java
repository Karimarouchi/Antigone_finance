package tn.antigone.finace.feature;

import lombok.RequiredArgsConstructor;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.aspectj.lang.reflect.MethodSignature;
import org.aspectj.lang.JoinPoint;
import org.springframework.stereotype.Component;
import tn.antigone.finace.common.ForbiddenException;
import tn.antigone.finace.security.SecurityUtils;

import java.lang.reflect.Method;
import java.util.Arrays;

@Aspect
@Component
@RequiredArgsConstructor
public class FeatureGuardAspect {

    private final FeatureService featureService;

    @Before("@annotation(tn.antigone.finace.feature.RequireFeature) || @within(tn.antigone.finace.feature.RequireFeature)")
    public void check(JoinPoint jp) {
        Method method = ((MethodSignature) jp.getSignature()).getMethod();
        RequireFeature ann = method.getAnnotation(RequireFeature.class);
        if (ann == null)
            ann = method.getDeclaringClass().getAnnotation(RequireFeature.class);
        if (ann == null)
            return;

        var principal = SecurityUtils.requirePrincipal();
        if ("super_admin".equals(principal.getRole()))
            return;
        var userId = principal.getId();
        boolean ok = Arrays.stream(ann.value()).anyMatch(f -> featureService.has(userId, f));
        if (!ok) {
            throw new ForbiddenException("Required feature(s): " + String.join(", ", ann.value()));
        }
    }
}
