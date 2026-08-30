package tn.antigone.finace.storage;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
public class ClientLogosAliasController {

    private final StorageService storage;

    @PostMapping("/api/client-logos")
    public StorageController.UploadResp upload(@RequestParam("file") MultipartFile file) {
        String key = storage.store("client-logos", file);
        String url = "/api/storage/files/" + key;
        return new StorageController.UploadResp(key, url);
    }
}
