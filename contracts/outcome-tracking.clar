;; Outcome Tracking Contract
;; Monitors academic progress of recipients

;; Data Variables
(define-data-var contract-owner principal tx-sender)
(define-map academic-records
  { record-id: uint }
  {
    applicant-id: uint,
    semester: (string-ascii 20),
    gpa: uint,
    credits-completed: uint,
    status: (string-ascii 20),
    timestamp: uint
  }
)
(define-map milestones
  { milestone-id: uint }
  {
    applicant-id: uint,
    description: (string-ascii 100),
    achieved: bool,
    timestamp: uint
  }
)
(define-data-var record-counter uint u0)
(define-data-var milestone-counter uint u0)

;; Error Codes
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-RECORD-NOT-FOUND u101)
(define-constant ERR-MILESTONE-NOT-FOUND u102)

;; Read-Only Functions
(define-read-only (get-academic-record (record-id uint))
  (map-get? academic-records { record-id: record-id })
)

(define-read-only (get-milestone (milestone-id uint))
  (map-get? milestones { milestone-id: milestone-id })
)

(define-read-only (get-record-count)
  (var-get record-counter)
)

(define-read-only (get-milestone-count)
  (var-get milestone-counter)
)

;; Public Functions
(define-public (add-academic-record
                (applicant-id uint)
                (semester (string-ascii 20))
                (gpa uint)
                (credits-completed uint))
  (let ((record-id (+ (var-get record-counter) u1)))
    (asserts! (or (is-eq tx-sender (var-get contract-owner))
                 (is-authorized-institution tx-sender))
             (err ERR-NOT-AUTHORIZED))

    (map-set academic-records
      { record-id: record-id }
      {
        applicant-id: applicant-id,
        semester: semester,
        gpa: gpa,
        credits-completed: credits-completed,
        status: "verified",
        timestamp: block-height
      }
    )

    (var-set record-counter record-id)
    (ok record-id)
  )
)

(define-public (add-milestone
                (applicant-id uint)
                (description (string-ascii 100)))
  (let ((milestone-id (+ (var-get milestone-counter) u1)))
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))

    (map-set milestones
      { milestone-id: milestone-id }
      {
        applicant-id: applicant-id,
        description: description,
        achieved: false,
        timestamp: block-height
      }
    )

    (var-set milestone-counter milestone-id)
    (ok milestone-id)
  )
)

(define-public (mark-milestone-achieved (milestone-id uint))
  (let ((milestone (unwrap! (get-milestone milestone-id) (err ERR-MILESTONE-NOT-FOUND))))
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))

    (map-set milestones
      { milestone-id: milestone-id }
      (merge milestone {
        achieved: true,
        timestamp: block-height
      })
    )

    (ok true)
  )
)

(define-public (update-record-status (record-id uint) (new-status (string-ascii 20)))
  (let ((record (unwrap! (get-academic-record record-id) (err ERR-RECORD-NOT-FOUND))))
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))

    (map-set academic-records
      { record-id: record-id }
      (merge record { status: new-status })
    )

    (ok true)
  )
)

;; Helper functions
(define-private (is-authorized-institution (user principal))
  ;; In a real implementation, this would check against registered institutions
  ;; For simplicity, we're just returning false here
  false
)

