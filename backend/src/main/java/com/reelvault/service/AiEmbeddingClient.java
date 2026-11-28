package com.reelvault.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class AiEmbeddingClient {

    public static final int EMBEDDING_DIMENSION = 768;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String aiServiceUrl;

    public record EmbeddingResult(float[] vector, String model) {}

    public AiEmbeddingClient(
            ObjectMapper objectMapper,
            @Value("${reelvault.ai-service.url:http://localhost:8000}") String aiServiceUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(20));
        this.restTemplate = new RestTemplate(factory);
        this.objectMapper = objectMapper;
        this.aiServiceUrl = aiServiceUrl.endsWith("/") ? aiServiceUrl.substring(0, aiServiceUrl.length() - 1) : aiServiceUrl;
    }

    public EmbeddingResult embedText(String text, String taskType) {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("Text to embed must not be blank");
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, String> payload = Map.of(
                    "text", text,
                    "task_type", taskType != null ? taskType : "RETRIEVAL_QUERY"
            );
            String body = objectMapper.writeValueAsString(payload);
            HttpEntity<String> entity = new HttpEntity<>(body, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(
                    aiServiceUrl + "/api/embeddings",
                    entity,
                    String.class
            );

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new IllegalStateException("AI service returned status " + response.getStatusCode());
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode embNode = root.get("embedding");
            if (embNode == null || !embNode.isArray() || embNode.isEmpty()) {
                throw new IllegalStateException("AI service returned empty embedding");
            }

            float[] vec = new float[embNode.size()];
            for (int i = 0; i < embNode.size(); i++) {
                vec[i] = (float) embNode.get(i).asDouble();
            }
            String model = root.hasNonNull("model") ? root.get("model").asText() : "unknown";
            return new EmbeddingResult(vec, model);
        } catch (Exception e) {
            log.warn("Failed to generate embedding via AI service ({}): {}", aiServiceUrl, e.getMessage());
            throw new RuntimeException("Failed to generate embedding from AI service: " + e.getMessage(), e);
        }
    }

    public static String buildDocumentText(
            String caption,
            String transcript,
            String summary,
            List<String> tags,
            String authorName) {
        StringBuilder sb = new StringBuilder();
        if (summary != null && !summary.isBlank()) {
            sb.append("Summary: ").append(summary.trim()).append("\n");
        }
        if (caption != null && !caption.isBlank()) {
            sb.append("Caption: ").append(caption.trim()).append("\n");
        }
        if (transcript != null && !transcript.isBlank()) {
            sb.append("Transcript: ").append(transcript.trim()).append("\n");
        }
        if (tags != null && !tags.isEmpty()) {
            List<String> cleanTags = tags.stream()
                    .filter(t -> t != null && !t.isBlank())
                    .map(t -> t.trim().replaceFirst("^#", ""))
                    .toList();
            if (!cleanTags.isEmpty()) {
                sb.append("Tags: ").append(String.join(", ", cleanTags)).append("\n");
            }
        }
        if (authorName != null && !authorName.isBlank()) {
            sb.append("Creator: ").append(authorName.trim()).append("\n");
        }
        String result = sb.toString().trim();
        if (result.isEmpty()) {
            return "Saved social media video reel";
        }
        return result.length() > 8000 ? result.substring(0, 8000) : result;
    }
}
