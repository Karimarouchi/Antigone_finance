package tn.antigone.finace.mail;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.BadRequestException;
import tn.antigone.finace.feature.RequireFeature;

import java.util.Base64;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequireFeature({ "invoice", "invoice-creator", "encaissements-factures", "payments" })
public class SendInvoiceAliasController {

    private final MailService mail;

    public record SendInvoiceReq(String to, String subject, String body, String html,
            String pdfBase64, String filename) {
    }

    @PostMapping("/api/send-invoice")
    public Map<String, String> send(@RequestBody SendInvoiceReq r) {
        if (r.to() == null || r.to().isBlank())
            throw new BadRequestException("Destinataire requis");
        String content = r.html() != null ? r.html() : r.body();
        if (content == null)
            throw new BadRequestException("Contenu requis");

        List<MailService.Attachment> attachments = List.of();
        if (r.pdfBase64() != null && !r.pdfBase64().isBlank()) {
            byte[] bytes;
            try {
                bytes = Base64.getDecoder().decode(r.pdfBase64());
            } catch (IllegalArgumentException e) {
                throw new BadRequestException("pdfBase64 invalide");
            }
            String fname = (r.filename() == null || r.filename().isBlank()) ? "facture.pdf" : r.filename();
            attachments = List.of(new MailService.Attachment(fname, bytes, "application/pdf"));
        }

        mail.sendHtml(r.to(),
                r.subject() == null ? "Facture" : r.subject(),
                content.startsWith("<") ? content
                        : "<pre style=\"font-family:inherit;white-space:pre-wrap\">" + escape(content) + "</pre>",
                attachments);
        return Map.of("status", "sent");
    }

    private static String escape(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
