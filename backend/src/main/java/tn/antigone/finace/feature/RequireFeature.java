package tn.antigone.finace.feature;

import java.lang.annotation.*;

/**
 * Method-level guard. Mirrors {@code withFeature()} from the Next.js codebase.
 *
 * <pre>{@code
 * @RequireFeature("decaissements-salaires")
 * @PostMapping
 * public Salary create(@RequestBody Salary in) { ... }
 * }</pre>
 *
 * Multiple ids = ANY (OR). For AND semantics chain multiple annotations
 * on a meta-annotation.
 */
@Target({ ElementType.METHOD, ElementType.TYPE })
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface RequireFeature {
    /** Feature ids — granted if the user holds ANY of them. */
    String[] value();
}
