package tn.antigone.finace.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "app")
public class AppProperties {
    private Jwt jwt = new Jwt();
    private Cors cors = new Cors();
    private Mail mail = new Mail();
    private Storage storage = new Storage();
    private String baseUrl;
    private String frontendUrl;

    @Data
    public static class Jwt {
        private String secret;
        private long accessTtlMinutes = 15;
        private long refreshTtlDays = 30;
    }

    @Data
    public static class Cors {
        private String allowedOrigins = "http://localhost:5173";
    }

    @Data
    public static class Mail {
        private String from;
    }

    @Data
    public static class Storage {
        private String path = "./storage";
    }
}
