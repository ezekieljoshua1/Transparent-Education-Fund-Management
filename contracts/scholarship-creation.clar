;; Scholarship Creation Contract
;; Defines criteria and award amounts for scholarships

;; Data Variables
(define-data-var contract-owner principal tx-sender)
(define-map scholarships
  { scholarship-id: uint }
  {
    name: (string-ascii 100),
    description: (string-ascii 500),
    total-amount: uint,
    award-amount: uint,
    remaining-funds: uint,
    criteria-gpa: uint,
    criteria-field: (string-ascii 50),
    active: bool
  }
)
(define-data-var scholarship-counter uint u0)

;; Error Codes
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-AMOUNT u101)
(define-constant ERR-SCHOLARSHIP-NOT-FOUND u102)

;; Read-Only Functions
(define-read-only (get-scholarship (scholarship-id uint))
  (map-get? scholarships { scholarship-id: scholarship-id })
)

(define-read-only (get-scholarship-count)
  (var-get scholarship-counter)
)

;; Public Functions
(define-public (create-scholarship
                (name (string-ascii 100))
                (description (string-ascii 500))
                (total-amount uint)
                (award-amount uint)
                (criteria-gpa uint)
                (criteria-field (string-ascii 50)))
  (let ((scholarship-id (+ (var-get scholarship-counter) u1)))
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (asserts! (>= total-amount award-amount) (err ERR-INVALID-AMOUNT))

    (map-set scholarships
      { scholarship-id: scholarship-id }
      {
        name: name,
        description: description,
        total-amount: total-amount,
        award-amount: award-amount,
        remaining-funds: total-amount,
        criteria-gpa: criteria-gpa,
        criteria-field: criteria-field,
        active: true
      }
    )

    (var-set scholarship-counter scholarship-id)
    (ok scholarship-id)
  )
)

(define-public (fund-scholarship (scholarship-id uint) (amount uint))
  (let ((scholarship (unwrap! (get-scholarship scholarship-id) (err ERR-SCHOLARSHIP-NOT-FOUND))))
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))

    (map-set scholarships
      { scholarship-id: scholarship-id }
      (merge scholarship {
        total-amount: (+ (get total-amount scholarship) amount),
        remaining-funds: (+ (get remaining-funds scholarship) amount)
      })
    )

    (ok true)
  )
)

(define-public (deactivate-scholarship (scholarship-id uint))
  (let ((scholarship (unwrap! (get-scholarship scholarship-id) (err ERR-SCHOLARSHIP-NOT-FOUND))))
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))

    (map-set scholarships
      { scholarship-id: scholarship-id }
      (merge scholarship { active: false })
    )

    (ok true)
  )
)

(define-public (activate-scholarship (scholarship-id uint))
  (let ((scholarship (unwrap! (get-scholarship scholarship-id) (err ERR-SCHOLARSHIP-NOT-FOUND))))
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))

    (map-set scholarships
      { scholarship-id: scholarship-id }
      (merge scholarship { active: true })
    )

    (ok true)
  )
)

