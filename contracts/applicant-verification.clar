;; Applicant Verification Contract
;; Validates student qualifications

;; Data Variables
(define-data-var contract-owner principal tx-sender)
(define-map applicants
  { applicant-id: uint }
  {
    principal: principal,
    name: (string-ascii 100),
    institution: (string-ascii 100),
    gpa: uint,
    field-of-study: (string-ascii 50),
    verified: bool
  }
)
(define-map applications
  { application-id: uint }
  {
    applicant-id: uint,
    scholarship-id: uint,
    status: (string-ascii 20),
    timestamp: uint
  }
)
(define-data-var applicant-counter uint u0)
(define-data-var application-counter uint u0)

;; Error Codes
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-APPLICANT-NOT-FOUND u101)
(define-constant ERR-APPLICATION-NOT-FOUND u102)
(define-constant ERR-ALREADY-VERIFIED u103)

;; Read-Only Functions
(define-read-only (get-applicant (applicant-id uint))
  (map-get? applicants { applicant-id: applicant-id })
)

(define-read-only (get-application (application-id uint))
  (map-get? applications { application-id: application-id })
)

(define-read-only (get-applicant-count)
  (var-get applicant-counter)
)

(define-read-only (get-application-count)
  (var-get application-counter)
)

;; Public Functions
(define-public (register-applicant
                (name (string-ascii 100))
                (institution (string-ascii 100))
                (gpa uint)
                (field-of-study (string-ascii 50)))
  (let ((applicant-id (+ (var-get applicant-counter) u1)))
    (map-set applicants
      { applicant-id: applicant-id }
      {
        principal: tx-sender,
        name: name,
        institution: institution,
        gpa: gpa,
        field-of-study: field-of-study,
        verified: false
      }
    )

    (var-set applicant-counter applicant-id)
    (ok applicant-id)
  )
)

(define-public (apply-for-scholarship (applicant-id uint) (scholarship-id uint))
  (let ((application-id (+ (var-get application-counter) u1))
        (applicant (unwrap! (get-applicant applicant-id) (err ERR-APPLICANT-NOT-FOUND))))

    (asserts! (is-eq tx-sender (get principal applicant)) (err ERR-NOT-AUTHORIZED))

    (map-set applications
      { application-id: application-id }
      {
        applicant-id: applicant-id,
        scholarship-id: scholarship-id,
        status: "pending",
        timestamp: block-height
      }
    )

    (var-set application-counter application-id)
    (ok application-id)
  )
)

(define-public (verify-applicant (applicant-id uint))
  (let ((applicant (unwrap! (get-applicant applicant-id) (err ERR-APPLICANT-NOT-FOUND))))
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (get verified applicant)) (err ERR-ALREADY-VERIFIED))

    (map-set applicants
      { applicant-id: applicant-id }
      (merge applicant { verified: true })
    )

    (ok true)
  )
)

(define-public (update-application-status (application-id uint) (new-status (string-ascii 20)))
  (let ((application (unwrap! (get-application application-id) (err ERR-APPLICATION-NOT-FOUND))))
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))

    (map-set applications
      { application-id: application-id }
      (merge application { status: new-status })
    )

    (ok true)
  )
)

