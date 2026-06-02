package tn.antigone.finace.common;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class StringArrayConverter implements AttributeConverter<String[], String> {

    @Override
    public String convertToDatabaseColumn(String[] attribute) {
        if (attribute == null || attribute.length == 0) return "{}";
        StringBuilder sb = new StringBuilder("{");
        for (int i = 0; i < attribute.length; i++) {
            if (i > 0) sb.append(",");
            sb.append('"').append(attribute[i].replace("\"", "\\\"")).append('"');
        }
        return sb.append("}").toString();
    }

    @Override
    public String[] convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.equals("{}")) return new String[0];
        String trimmed = dbData.substring(1, dbData.length() - 1);
        if (trimmed.isEmpty()) return new String[0];
        return trimmed.split(",");
    }
}
