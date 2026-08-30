package tn.antigone.finace.feature;

import java.util.Collection;
import java.util.List;
import java.util.Set;

/**
 * Admin UI grants granular ids (encaissements-factures, invoice-creator, …)
 * while some routes/APIs still check legacy/parent ids (encaissements, invoice).
 */
public final class FeatureIds {

    private static final List<Set<String>> CLUSTERS = List.of(
            Set.of(
                    "encaissements",
                    "encaissements-overview",
                    "encaissements-factures",
                    "encaissements-autres-revenus",
                    "encaissements-autres"),
            Set.of(
                    "decaissements",
                    "decaissements-overview",
                    "decaissements-salaires",
                    "decaissements-charges-fixes",
                    "decaissements-charges-variables",
                    "decaissements-charges",
                    "decaissements-etat",
                    "decaissements-dettes",
                    "decaissements-cnss"),
            Set.of(
                    "invoice",
                    "invoice-creator",
                    "clients",
                    "contacts",
                    "payments",
                    "encaissements-factures"));

    private FeatureIds() {}

    public static boolean granted(Collection<String> userFeatures, String required) {
        if (userFeatures == null || required == null) return false;
        if (userFeatures.contains(required)) return true;
        for (Set<String> cluster : CLUSTERS) {
            if (cluster.contains(required) && userFeatures.stream().anyMatch(cluster::contains)) {
                return true;
            }
        }
        return false;
    }
}
