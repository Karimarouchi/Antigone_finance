package tn.antigone.finace.payroll;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.NotFoundException;
import tn.antigone.finace.feature.RequireFeature;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/employees")
@RequiredArgsConstructor
@RequireFeature({ "decaissements-salaires", "decaissements" })
public class EmployeeController {

    private final EmployeeRepository repo;
    private final ObjectMapper mapper;

    @GetMapping
    public List<Employee> list(@RequestParam(defaultValue = "false") boolean includeArchived) {
        return includeArchived ? repo.findAll()
                : repo.findAllByArchivedAtIsNullOrderByNomAscPrenomAsc();
    }

    @GetMapping("/{id}")
    public Employee get(@PathVariable UUID id) {
        return repo.findById(id).orElseThrow(() -> new NotFoundException("Employé introuvable"));
    }

    @PostMapping
    @Transactional
    public Employee create(@RequestBody Map<String, Object> in) {
        Employee e = new Employee();
        e.setEnfants(0);
        e.setSalaireBase(BigDecimal.ZERO);
        e.setTypeContrat("CDI");
        applyPatch(e, in);
        e.setArchivedAt(null);
        return repo.save(e);
    }

    @PutMapping("/{id}")
    @PatchMapping("/{id}")
    @Transactional
    public Employee update(@PathVariable UUID id, @RequestBody Map<String, Object> patch) {
        Employee e = get(id);
        applyPatch(e, patch);
        return repo.save(e);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) {
        repo.deleteById(id);
    }

    @PostMapping("/{id}/archive")
    @Transactional
    public Employee archive(@PathVariable UUID id, @RequestBody(required = false) Map<String, Object> body) {
        Employee e = get(id);
        e.setArchivedAt(Instant.now());
        if (body != null && body.get("archived_at") instanceof String s && !s.isBlank())
            e.setArchivedAt(Instant.parse(s.endsWith("Z") || s.length() > 10 ? s : s + "T00:00:00Z"));
        e.setDateRetour(null);
        return repo.save(e);
    }

    @PostMapping("/{id}/restore")
    @Transactional
    public Employee restore(@PathVariable UUID id, @RequestBody(required = false) Map<String, Object> body) {
        Employee e = get(id);
        if (body != null && body.get("date_retour") instanceof String s && !s.isBlank()) {
            e.setDateRetour(LocalDate.parse(s.substring(0, Math.min(10, s.length()))));
        } else {
            e.setDateRetour(LocalDate.now());
        }
        return repo.save(e);
    }

    // ────────────────────────────────────────────────────────────
    private void applyPatch(Employee e, Map<String, Object> patch) {
        for (var entry : patch.entrySet()) {
            String k = entry.getKey();
            Object v = entry.getValue();
            switch (k) {
                case "nom" -> e.setNom(asString(v));
                case "prenom" -> e.setPrenom(asString(v));
                case "cin" -> e.setCin(asString(v));
                case "email" -> e.setEmail(asString(v));
                case "phone", "telephone" -> e.setPhone(asString(v));
                case "poste" -> e.setPoste(asString(v));
                case "departement" -> e.setDepartement(asString(v));
                case "salaire_base", "salaireBase" -> e.setSalaireBase(asBigDecimal(v));
                case "type_contrat", "typeContrat" -> e.setTypeContrat(asString(v));
                case "date_naissance", "dateNaissance" -> e.setDateNaissance(asLocalDate(v));
                case "lieu_naissance", "lieuNaissance" -> e.setLieuNaissance(asString(v));
                case "situation_familiale", "situationFamiliale" -> e.setSituationFamiliale(asString(v));
                case "enfants" -> e.setEnfants(asInteger(v));
                case "adresse", "address" -> e.setAddress(asString(v));
                case "date_debut", "dateDebut" -> e.setDateDebut(asLocalDate(v));
                case "date_fin", "dateFin" -> e.setDateFin(asLocalDate(v));
                case "date_retour", "dateRetour" -> e.setDateRetour(asLocalDate(v));
                case "date_embauche" -> e.setDateEmbauche(asLocalDate(v));
                case "date_sortie" -> e.setDateSortie(asLocalDate(v));
                case "numero_cnss", "numeroCnss", "cnss_number", "cnssNumber" -> {
                    String n = asString(v);
                    e.setNumeroCnss(n);
                    e.setCnssNumber(n);
                }
                case "banque" -> e.setBanque(asString(v));
                case "rib" -> e.setRib(asString(v));
                case "gains" -> e.setGains(asJson(v));
                case "retenues" -> e.setRetenues(asJson(v));
                case "archived_at", "archivedAt" -> e.setArchivedAt(asInstant(v));
                default -> {
                    /* ignore unknown */ }
            }
        }
    }

    private String asString(Object v) {
        return v == null ? null : v.toString();
    }

    private Integer asInteger(Object v) {
        return v == null ? null : (v instanceof Number n ? n.intValue() : Integer.parseInt(v.toString()));
    }

    private BigDecimal asBigDecimal(Object v) {
        if (v == null)
            return null;
        if (v instanceof Number n)
            return BigDecimal.valueOf(n.doubleValue());
        return new BigDecimal(v.toString());
    }

    private LocalDate asLocalDate(Object v) {
        if (v == null)
            return null;
        String s = v.toString();
        if (s.isBlank())
            return null;
        return LocalDate.parse(s.substring(0, Math.min(10, s.length())));
    }

    private Instant asInstant(Object v) {
        if (v == null)
            return null;
        String s = v.toString();
        if (s.isBlank())
            return null;
        if (s.length() == 10)
            s = s + "T00:00:00Z";
        return Instant.parse(s);
    }

    private JsonNode asJson(Object v) {
        return v == null ? null : mapper.valueToTree(v);
    }
}
