package tn.antigone.finace.feature;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FeatureService {

    private final UserFeatureRepository repo;

    public List<String> listFeatures(UUID userId) {
        return repo.findFeatureIdsByUserId(userId);
    }

    public boolean has(UUID userId, String featureId) {
        return repo.existsByUserIdAndFeatureId(userId, featureId);
    }

    @Transactional
    public void grant(UUID userId, String featureId, UUID grantedBy) {
        if (repo.existsByUserIdAndFeatureId(userId, featureId)) return;
        repo.save(UserFeature.builder()
                .userId(userId).featureId(featureId)
                .grantedAt(Instant.now()).grantedBy(grantedBy).build());
    }

    @Transactional
    public void revoke(UUID userId, String featureId) {
        repo.deleteByUserIdAndFeatureId(userId, featureId);
    }
}
