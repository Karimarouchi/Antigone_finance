package tn.antigone.finace.feature;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface UserFeatureRepository extends JpaRepository<UserFeature, UUID> {
    List<UserFeature> findAllByUserId(UUID userId);
    boolean existsByUserIdAndFeatureId(UUID userId, String featureId);
    void deleteByUserIdAndFeatureId(UUID userId, String featureId);

    @Query("select uf.featureId from UserFeature uf where uf.userId = :uid")
    List<String> findFeatureIdsByUserId(UUID uid);
}
