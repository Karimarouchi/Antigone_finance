package tn.antigone.finace.common;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.stereotype.Component;

/** JPA converter for {@code jsonb} columns ⇄ Jackson {@link JsonNode}. */
@Converter
@Component
public class JsonNodeConverter implements AttributeConverter<JsonNode, String>, ApplicationContextAware {

    private static ObjectMapper MAPPER;

    @Override
    public void setApplicationContext(ApplicationContext ctx) {
        MAPPER = ctx.getBean(ObjectMapper.class);
    }

    @Autowired
    public void setMapper(ObjectMapper mapper) { MAPPER = mapper; }

    @Override
    public String convertToDatabaseColumn(JsonNode node) {
        if (node == null) return null;
        try { return MAPPER.writeValueAsString(node); }
        catch (Exception e) { throw new RuntimeException("jsonb write failed", e); }
    }

    @Override
    public JsonNode convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try { return MAPPER.readTree(dbData); }
        catch (Exception e) { throw new RuntimeException("jsonb read failed", e); }
    }
}
