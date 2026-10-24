package com.reelvault.repository;

import com.reelvault.entity.Reel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReelRepository extends JpaRepository<Reel, UUID> {
    
    List<Reel> findAllByOrderByCreatedAtDesc();

    List<Reel> findByCollectionUserIdOrderByCreatedAtDesc(UUID userId);

    List<Reel> findByCollectionIdOrderByCreatedAtDesc(UUID collectionId);

    List<Reel> findByCollectionIdAndCollectionUserIdOrderByCreatedAtDesc(UUID collectionId, UUID userId);

    long countByCollectionId(UUID collectionId);

    boolean existsByCollectionIdAndShortcode(UUID collectionId, String shortcode);

    Optional<Reel> findFirstByShortcode(String shortcode);

    @Query("SELECT DISTINCT r FROM Reel r LEFT JOIN r.tags t WHERE (" +
           "LOWER(COALESCE(r.caption, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(COALESCE(r.transcript, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(COALESCE(r.summary, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(COALESCE(r.authorName, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(COALESCE(t, '')) LIKE LOWER(CONCAT('%', :query, '%'))" +
           ") ORDER BY r.createdAt DESC")
    List<Reel> searchByCaption(@Param("query") String query);

    @Query("SELECT DISTINCT r FROM Reel r LEFT JOIN r.tags t WHERE r.collection.id = :collectionId AND (" +
           "LOWER(COALESCE(r.caption, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(COALESCE(r.transcript, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(COALESCE(r.summary, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(COALESCE(r.authorName, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(COALESCE(t, '')) LIKE LOWER(CONCAT('%', :query, '%'))" +
           ") ORDER BY r.createdAt DESC")
    List<Reel> searchByCollectionAndCaption(@Param("collectionId") UUID collectionId, @Param("query") String query);

    @Query("SELECT DISTINCT r FROM Reel r LEFT JOIN r.tags t WHERE (r.collection.user IS NULL OR r.collection.user.id = :userId) AND (" +
           "LOWER(COALESCE(r.caption, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(COALESCE(r.transcript, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(COALESCE(r.summary, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(COALESCE(r.authorName, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(COALESCE(t, '')) LIKE LOWER(CONCAT('%', :query, '%'))" +
           ") ORDER BY r.createdAt DESC")
    List<Reel> searchByUserAndCaption(@Param("userId") UUID userId, @Param("query") String query);

    @Query("SELECT DISTINCT r FROM Reel r LEFT JOIN r.tags t WHERE r.collection.id = :collectionId AND (r.collection.user IS NULL OR r.collection.user.id = :userId) AND (" +
           "LOWER(COALESCE(r.caption, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(COALESCE(r.transcript, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(COALESCE(r.summary, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(COALESCE(r.authorName, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(COALESCE(t, '')) LIKE LOWER(CONCAT('%', :query, '%'))" +
           ") ORDER BY r.createdAt DESC")
    List<Reel> searchByUserAndCollectionAndCaption(@Param("userId") UUID userId, @Param("collectionId") UUID collectionId, @Param("query") String query);
}
