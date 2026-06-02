package tn.antigone.finace.storage;

import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import tn.antigone.finace.common.BadRequestException;
import tn.antigone.finace.common.NotFoundException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/storage")
@RequiredArgsConstructor
public class StorageController {

    private final StorageService storage;
    private static final Set<String> BUCKETS = Set.of(
            "client-logos", "avatars", "invoices", "documents", "attachments");

    public record UploadResp(String key, String url) {}

    @PostMapping("/upload/{bucket}")
    public UploadResp upload(@PathVariable String bucket, @RequestParam("file") MultipartFile file) {
        if (!BUCKETS.contains(bucket)) throw new BadRequestException("Bucket inconnu: " + bucket);
        String key = storage.store(bucket, file);
        String url = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/storage/files/").path(key).toUriString();
        return new UploadResp(key, url);
    }

    @GetMapping("/files/**")
    public ResponseEntity<Resource> serve(@RequestParam(required = false) String download,
                                          jakarta.servlet.http.HttpServletRequest req) throws IOException {
        String full = req.getRequestURI();
        String prefix = req.getContextPath() + "/api/storage/files/";
        if (!full.startsWith(prefix)) throw new NotFoundException("Fichier introuvable");
        String key = full.substring(prefix.length());

        Path p = storage.resolve(key);
        if (!Files.exists(p)) throw new NotFoundException("Fichier introuvable");
        String contentType = Files.probeContentType(p);
        if (contentType == null) contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;

        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.parseMediaType(contentType));
        h.setContentLength(Files.size(p));
        if (download != null) {
            h.setContentDisposition(ContentDisposition.attachment()
                    .filename(p.getFileName().toString()).build());
        }
        return new ResponseEntity<>(new FileSystemResource(p), h, HttpStatus.OK);
    }

    @DeleteMapping("/files")
    public Map<String, String> delete(@RequestParam String key) {
        storage.delete(key);
        return Map.of("status", "ok");
    }
}
