package tn.antigone.finace.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(AppProperties.class)
public class AppConfig {

    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .findAndRegisterModules()
                // Serialize java.time types (LocalDate/Instant) as ISO-8601 strings
                // (e.g. "2026-05-01") instead of numeric arrays/timestamps, matching
                // the ISO date format every frontend hook expects.
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }
}
