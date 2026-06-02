package tn.antigone.finace.mail;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.BadRequestException;
import tn.antigone.finace.feature.RequireFeature;
import tn.antigone.finace.storage.StorageService;

import java.nio.file.Files;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/mail")
@RequiredArgsConstructor
@RequireFeature({"invoice", "payments"})
public class MailController {

    private final MailService mail;
    private final StorageService storage;

    public record SendInvoiceReq(String to, String subject, String html,
                                 List<String> attachmentKeys) {}

    /**
     * Sends an HTML email plus optional storage-resident attachments
     * (PDFs uploaded via /api/storage/upload/...).
     * Replaces the Next.js {@code app/api/send-invoice} route.
     */
    @PostMapping("/send-invoice")
    public Map<String, String> sendInvoice(@RequestBody SendInvoiceReq r) throws Exception {
        if (r.to() == null || r.to().isBlank()) throw new BadRequestException("Destinataire requis");
        if (r.html() == null) throw new BadRequestException("Contenu requis");

        List<MailService.Attachment> attachments = r.attachmentKeys() == null ? List.of()
                : r.attachmentKeys().stream()
                    .map(k -> {
                        var path = storage.resolve(k);
                        if (!Files.exists(path))
                            throw new BadRequestException("Pièce jointe introuvable: " + k);
                        try { return MailService.Attachment.fromFile(path); }
                        catch (Exception e) { throw new RuntimeException(e); }
                    }).toList();

        mail.sendHtml(r.to(),
                r.subject() == null ? "Facture" : r.subject(),
                r.html(), attachments);
        return Map.of("status", "sent");
    }
}
