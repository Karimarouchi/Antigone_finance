package tn.antigone.finace.storage;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tn.antigone.finace.common.BadRequestException;
import tn.antigone.finace.config.AppProperties;

import java.io.IOException;
import java.nio.file.*;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Local-filesystem storage. Drop-in replacement for Supabase Storage.
 *
 * Keys look like:
 *   client-logos/2025-12/4b7f….png
 *   pdfs/2025-12/4b7f….pdf
 *
 * Uploaded files are served via {@code GET /api/storage/files/{key…}}.
 */
@Service
@RequiredArgsConstructor
public class StorageService {

    private final AppProperties props;
    private static final SecureRandom RNG = new SecureRandom();

    public String store(String bucket, MultipartFile file) {
        if (file == null || file.isEmpty()) throw new BadRequestException("Fichier vide");
        String yearMonth = java.time.YearMonth.now().toString();
        String ext = extOf(file.getOriginalFilename());
        String key = bucket + "/" + yearMonth + "/" + randomId() + ext;
        Path dst = resolve(key);
        try {
            Files.createDirectories(dst.getParent());
            file.transferTo(dst.toFile());
        } catch (IOException e) {
            throw new RuntimeException("Échec du stockage: " + e.getMessage(), e);
        }
        return key;
    }

    public Path resolve(String key) {
        Path root = Paths.get(props.getStorage().getPath()).toAbsolutePath().normalize();
        Path target = root.resolve(key).normalize();
        if (!target.startsWith(root)) throw new BadRequestException("Chemin invalide");
        return target;
    }

    public void delete(String key) {
        try { Files.deleteIfExists(resolve(key)); }
        catch (IOException e) { throw new RuntimeException(e); }
    }

    private static String randomId() {
        byte[] b = new byte[16];
        RNG.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    private static String extOf(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot).toLowerCase() : "";
    }
}
