package tn.antigone.finace.payroll;

import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.BadRequestException;
import tn.antigone.finace.common.NotFoundException;
import tn.antigone.finace.feature.RequireFeature;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/payroll")
@RequiredArgsConstructor
@RequireFeature({ "decaissements-salaires", "decaissements" })
public class PayrollController {

    private final SalaireMensuelRepository salaires;
    private final SalaryPartialRepository partials;

    // ── Monthly payslips ─────────────────────────────────────────────────────
    @GetMapping("/salaires")
    public List<SalaireMensuel> byMonth(@RequestParam String mois) {
        return salaires.findAllByMois(mois);
    }

    /** Global fetch of all monthly payslips (used by the Salaires module). */
    @GetMapping("/salaires/all")
    public List<SalaireMensuel> allSalaires() {
        return salaires.findAll();
    }

    @GetMapping("/salaires/employee/{employeeId}")
    public List<SalaireMensuel> byEmployee(@PathVariable UUID employeeId) {
        return salaires.findAllByEmployeeIdOrderByMoisDesc(employeeId);
    }

    @GetMapping("/salaires/{employeeId}/{mois}")
    public SalaireMensuel one(@PathVariable UUID employeeId, @PathVariable String mois) {
        return salaires.findByEmployeeIdAndMois(employeeId, mois).orElse(null);
    }

    /** Upsert pay slip for (employee, month). */
    @PostMapping("/salaires")
    @Transactional
    public SalaireMensuel upsert(@RequestBody SalaireMensuel in) {
        if (in.getEmployeeId() == null || in.getMois() == null)
            throw new BadRequestException("employeeId et mois requis");
        SalaireMensuel existing = salaires
                .findByEmployeeIdAndMois(in.getEmployeeId(), in.getMois())
                .orElse(null);
        if (existing != null) {
            in.setId(existing.getId());
            in.setCreatedAt(existing.getCreatedAt());
        }
        return salaires.save(in);
    }

    @DeleteMapping("/salaires/{id}")
    public void delete(@PathVariable UUID id) {
        salaires.deleteById(id);
    }

    // ── Partial payments ─────────────────────────────────────────────────────
    @GetMapping("/partials")
    public List<SalaryPartial> allPartials() {
        return partials.findAll();
    }

    @GetMapping("/partials/{employeeId}/{mois}")
    public List<SalaryPartial> listPartials(@PathVariable UUID employeeId,
            @PathVariable String mois) {
        return partials.findAllByEmployeeIdAndMoisOrderByDateAsc(employeeId, mois);
    }

    @PostMapping("/partials")
    @Transactional
    public SalaryPartial addPartial(@RequestBody SalaryPartial in) {
        if (in.getMontant() == null || in.getMontant().signum() <= 0)
            throw new BadRequestException("Montant invalide");
        in.setId(null);
        if (in.getDate() == null)
            in.setDate(LocalDate.now());
        if (in.getNote() == null)
            in.setNote("");
        // Pure audit insert — montant_paye on salaire_mensuel is maintained
        // explicitly by the frontend (recordAcompteForMois) to avoid double counting.
        return partials.save(in);
    }

    @DeleteMapping("/partials/{id}")
    public void deletePartial(@PathVariable UUID id) {
        partials.deleteById(id);
    }

    // TODO[migrate]: port `calculerFichePaie()` from
    // features/decaissements/salaires/services
    // (CNSS 9.18% / CSS 0.5% / IRPP barème tunisien). Expose as POST
    // /api/payroll/calculate.
    @PostMapping("/calculate")
    public Map<String, Object> calculate(@RequestBody Map<String, Object> input) {
        throw new UnsupportedOperationException(
                "TODO[migrate]: implement Tunisian CNSS+IRPP calculation");
    }
}
