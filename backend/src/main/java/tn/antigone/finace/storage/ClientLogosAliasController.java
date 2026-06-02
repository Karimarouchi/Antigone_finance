package tn.antigone.finace.storage;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
@RequiredArgsConstructor
public class ClientLogosAliasController {

    private final StorageService storage;

    @PostMapping("/api/client-logos")
    public StorageController.UploadResp upload(@RequestParam("file") MultipartFile file) {
        String key = storage.store("client-logos", file);
        String url = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/storage/files/").path(key).toUriString();
        return new StorageController.UploadResp(key, url);
    }
}
