package com.reelvault.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.reelvault.exception.BadRequestException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class InstagramService {

    private static final Pattern REEL_URL_PATTERN =
            Pattern.compile("(?:instagram\\.com\\/(?:reel|reels|p)\\/)([a-zA-Z0-9_-]+)", Pattern.CASE_INSENSITIVE);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${reelvault.instagram.access-token:}")
    private String accessToken;

    public InstagramService() {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    public record InstagramMetadata(
            String shortcode,
            String caption,
            String thumbnailUrl,
            String authorName
    ) {}

    /**
     * Extracts the shortcode from an Instagram URL.
     */
    public String extractShortcode(String url) {
        if (url == null || url.isBlank()) {
            throw new BadRequestException("Instagram URL must not be empty");
        }

        Matcher matcher = REEL_URL_PATTERN.matcher(url.trim());
        if (matcher.find()) {
            return matcher.group(1);
        }

        throw new BadRequestException("Invalid Instagram URL. Expected format: https://www.instagram.com/reel/<shortcode>/");
    }

    /**
     * Attempts to fetch metadata via Python AI service (yt-dlp) or Instagram oEmbed API, falling back gracefully.
     */
    public InstagramMetadata fetchMetadata(String url) {
        String shortcode = extractShortcode(url);
        String cleanUrl = "https://www.instagram.com/reel/" + shortcode + "/";

        // 1. Try Python AI metadata extractor (which uses yt-dlp without needing tokens)
        try {
            String aiMetadataUrl = "http://localhost:8000/api/metadata/?url=" + URLEncoder.encode(cleanUrl, StandardCharsets.UTF_8);
            ResponseEntity<String> response = restTemplate.getForEntity(aiMetadataUrl, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String caption = root.hasNonNull("caption") ? root.get("caption").asText() : "";
                String thumbnailUrl = root.hasNonNull("thumbnail_url") ? root.get("thumbnail_url").asText() : null;
                String authorName = root.hasNonNull("author_name") ? root.get("author_name").asText() : null;
                if (thumbnailUrl != null || (caption != null && !caption.isBlank())) {
                    log.info("Successfully fetched real metadata from Python service for shortcode: {}", shortcode);
                    return new InstagramMetadata(shortcode, caption, thumbnailUrl, authorName);
                }
            }
        } catch (Exception e) {
            log.debug("Python metadata service unavailable: {}", e.getMessage());
        }

        // 2. If Meta Access Token is available, use Meta Graph API oEmbed
        if (accessToken != null && !accessToken.isBlank()) {
            try {
                String oEmbedUrl = "https://graph.facebook.com/v12.0/instagram_oembed?url=" + cleanUrl + "&access_token=" + accessToken;
                InstagramMetadata meta = callOEmbed(oEmbedUrl, shortcode);
                if (meta != null) return meta;
            } catch (Exception e) {
                log.warn("Meta Graph oEmbed failed for shortcode {}: {}", shortcode, e.getMessage());
            }
        }

        // 3. Try standard Instagram oEmbed endpoint
        try {
            String publicOEmbedUrl = "https://api.instagram.com/oembed/?url=" + cleanUrl;
            InstagramMetadata meta = callOEmbed(publicOEmbedUrl, shortcode);
            if (meta != null) return meta;
        } catch (Exception e) {
            log.warn("Instagram public oEmbed unavailable for shortcode {}: {}", shortcode, e.getMessage());
        }

        // 4. Resilient Fallback: Ensure saving is never blocked
        log.info("Using fallback metadata for reel shortcode {}", shortcode);
        return new InstagramMetadata(
                shortcode,
                "Saved Instagram Reel (" + shortcode + ")",
                null,
                "Instagram Creator"
        );
    }

    private InstagramMetadata callOEmbed(String endpointUrl, String shortcode) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.USER_AGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            headers.setAccept(java.util.List.of(MediaType.APPLICATION_JSON));
            HttpEntity<String> entity = new HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    URI.create(endpointUrl),
                    HttpMethod.GET,
                    entity,
                    String.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String title = root.hasNonNull("title") ? root.get("title").asText() : "";
                String thumbnailUrl = root.hasNonNull("thumbnail_url") ? root.get("thumbnail_url").asText() : null;
                String authorName = root.hasNonNull("author_name") ? root.get("author_name").asText() : null;

                return new InstagramMetadata(shortcode, title, thumbnailUrl, authorName);
            }
        } catch (Exception e) {
            log.debug("oEmbed request failed: {}", e.getMessage());
        }
        return null;
    }
}
