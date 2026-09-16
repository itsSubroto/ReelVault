package com.reelvault.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.reelvault.entity.User;
import com.reelvault.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class AuthInterceptor implements HandlerInterceptor {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // Always allow CORS pre-flight OPTIONS requests
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String uri = request.getRequestURI();
        String method = request.getMethod();

        // 1. Public endpoints
        if (uri.startsWith("/api/auth/") ||
            uri.startsWith("/api/health") ||
            uri.startsWith("/h2-console")) {
            return true;
        }

        // 2. Allow Python AI service PATCH callback on reels
        if ("PATCH".equalsIgnoreCase(method) && uri.matches("^/api/reels/[^/]+$")) {
            return true;
        }

        // 3. Extract and validate Bearer token
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7).trim();
            if (jwtService.validateToken(token)) {
                UUID userId = jwtService.extractUserId(token);
                if (userId != null) {
                    User user = userRepository.findById(userId).orElse(null);
                    if (user != null) {
                        UserContext.setCurrentUser(user);
                        return true;
                    }
                }
            }
        }

        // 4. Unauthorized
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        Map<String, Object> errorBody = Map.of(
                "status", HttpServletResponse.SC_UNAUTHORIZED,
                "error", "Unauthorized",
                "message", "Valid authentication token is required"
        );
        response.getWriter().write(objectMapper.writeValueAsString(errorBody));
        return false;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        UserContext.clear();
    }
}
