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

    private static final Pattern INSTAGRAM_PATTERN =
            Pattern.compile("(?:instagram\\.com\\/(?:reel|reels|p)\\/)([a-zA-Z0-9_-]+)", Pattern.CASE_INSENSITIVE);

    private static final Pattern YOUTUBE_PATTERN =
            Pattern.compile("(?:youtube\\.com\\/shorts\\/|youtu\\.be\\/|youtube\\.com\\/watch\\?v=)([a-zA-Z0-9_-]+)", Pattern.CASE_INSENSITIVE);

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
     * Extracts the shortcode from an Instagram Reel or YouTube Short URL.
     */
    public String extractShortcode(String url) {
        if (url == null || url.isBlank()) {
            throw new BadRequestException("Video URL must not be empty");
        }

        String trimmed = url.trim();
        Matcher igMatcher = INSTAGRAM_PATTERN.matcher(trimmed);
        if (igMatcher.find()) {
            return igMatcher.group(1);
        }

        Matcher ytMatcher = YOUTUBE_PATTERN.matcher(trimmed);
        if (ytMatcher.find()) {
            return ytMatcher.group(1);
        }

        throw new BadRequestException("Invalid Instagram URL or YouTube Short. Expected format: https://www.instagram.com/reel/<shortcode>/ or https://www.youtube.com/shorts/<id>");
    }

    public boolean isYouTube(String url) {
        return url != null && (url.contains("youtube.com") || url.contains("youtu.be"));
    }

    /**
     * Attempts to fetch metadata via Python AI service (yt-dlp) or oEmbed APIs, falling back gracefully.
     */
    public InstagramMetadata fetchMetadata(String url) {
        String shortcode = extractShortcode(url);
        boolean isYt = isYouTube(url);
        String cleanUrl = isYt
                ? "https://www.youtube.com/shorts/" + shortcode
                : "https://www.instagram.com/reel/" + shortcode + "/";
        String fallbackPlatform = isYt ? "YouTube Short" : "Instagram Reel";
        String fallbackCreator = isYt ? "YouTube Creator" : "Instagram Creator";

        // 1. Try Python AI metadata extractor (yt-dlp handles both Instagram and YouTube)
        try {
            URI uri = org.springframework.web.util.UriComponentsBuilder
                    .fromUriString("http://localhost:8000/api/metadata")
                    .queryParam("url", cleanUrl)
                    .build()
                    .toUri();

            ResponseEntity<String> response = restTemplate.getForEntity(uri, String.class);
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

        // 2. If YouTube, try YouTube oEmbed
        if (isYt) {
            try {
                String ytOEmbedUrl = "https://www.youtube.com/oembed?url=" + cleanUrl + "&format=json";
                InstagramMetadata meta = callOEmbed(ytOEmbedUrl, shortcode);
                if (meta != null) return meta;
            } catch (Exception e) {
                log.warn("YouTube oEmbed failed for shortcode {}: {}", shortcode, e.getMessage());
            }
        } else {
            // 3. Instagram oEmbed (with Meta token if available)
            if (accessToken != null && !accessToken.isBlank()) {
                try {
                    String oEmbedUrl = "https://graph.facebook.com/v12.0/instagram_oembed?url=" + cleanUrl + "&access_token=" + accessToken;
                    InstagramMetadata meta = callOEmbed(oEmbedUrl, shortcode);
                    if (meta != null) return meta;
                } catch (Exception e) {
                    log.warn("Meta Graph oEmbed failed for shortcode {}: {}", shortcode, e.getMessage());
                }
            }

            // 4. Try standard Instagram oEmbed endpoint
            try {
                String publicOEmbedUrl = "https://api.instagram.com/oembed/?url=" + cleanUrl;
                InstagramMetadata meta = callOEmbed(publicOEmbedUrl, shortcode);
                if (meta != null) return meta;
            } catch (Exception e) {
                log.warn("Instagram public oEmbed unavailable for shortcode {}: {}", shortcode, e.getMessage());
            }
        }

        // 5. Resilient Fallback: Ensure saving is never blocked
        log.info("Using fallback metadata for {} shortcode {}", fallbackPlatform, shortcode);
        return new InstagramMetadata(
                shortcode,
                "Saved " + fallbackPlatform + " (" + shortcode + ")",
                null,
                fallbackCreator
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
