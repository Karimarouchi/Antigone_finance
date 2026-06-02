package tn.antigone.finace.mail;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import tn.antigone.finace.config.AppProperties;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class MailService {

    private final JavaMailSender sender;
    private final AppProperties props;

    public record Attachment(String filename, byte[] content, String contentType) {
        public static Attachment fromFile(Path p) throws IOException {
            return new Attachment(p.getFileName().toString(), Files.readAllBytes(p), Files.probeContentType(p));
        }
    }

    public void sendHtml(String to, String subject, String html, List<Attachment> attachments) {
        try {
            MimeMessage msg = sender.createMimeMessage();
            MimeMessageHelper h = new MimeMessageHelper(msg, true, "UTF-8");
            h.setFrom(props.getMail().getFrom());
            h.setTo(to);
            h.setSubject(subject);
            h.setText(html, true);
            if (attachments != null) {
                for (Attachment a : attachments) {
                    h.addAttachment(a.filename(),
                            new ByteArrayResource(a.content()),
                            a.contentType() == null ? "application/octet-stream" : a.contentType());
                }
            }
            sender.send(msg);
        } catch (Exception e) {
            log.error("Mail send failed for {}", to, e);
            throw new RuntimeException("Envoi du mail échoué: " + e.getMessage(), e);
        }
    }
}
