;; Fund Disbursement Contract
;; Manages payments to educational institutions

;; Data Variables
(define-data-var contract-owner principal tx-sender)
(define-map institutions
  { institution-id: uint }
  {
    name: (string-ascii 100),
    principal: principal,
    verified: bool
  }
)
(define-map disbursements
  { disbursement-id: uint }
  {
    application-id: uint,
    institution-id: uint,
    amount: uint,
    status: (string-ascii 20),
    timestamp: uint
  }
)
(define-data-var institution-counter uint u0)
(define-data-var disbursement-counter uint u0)

;; Error Codes
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INSTITUTION-NOT-FOUND u101)
(define-constant ERR-DISBURSEMENT-NOT-FOUND u102)
(define-constant ERR-INSUFFICIENT-FUNDS u103)

;; Read-Only Functions
(define-read-only (get-institution (institution-id uint))
  (map-get? institutions { institution-id: institution-id })
)

(define-read-only (get-disbursement (disbursement-id uint))
  (map-get? disbursements { disbursement-id: disbursement-id })
)

(define-read-only (get-institution-count)
  (var-get institution-counter)
)

(define-read-only (get-disbursement-count)
  (var-get disbursement-counter)
)

;; Public Functions
(define-public (register-institution (name (string-ascii 100)) (institution-principal principal))
  (let ((institution-id (+ (var-get institution-counter) u1)))
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))

    (map-set institutions
      { institution-id: institution-id }
      {
        name: name,
        principal: institution-principal,
        verified: true
      }
    )

    (var-set institution-counter institution-id)
    (ok institution-id)
  )
)

(define-public (create-disbursement (application-id uint) (institution-id uint) (amount uint))
  (let ((disbursement-id (+ (var-get disbursement-counter) u1))
        (institution (unwrap! (get-institution institution-id) (err ERR-INSTITUTION-NOT-FOUND))))

    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))

    (map-set disbursements
      { disbursement-id: disbursement-id }
      {
        application-id: application-id,
        institution-id: institution-id,
        amount: amount,
        status: "pending",
        timestamp: block-height
      }
    )

    (var-set disbursement-counter disbursement-id)
    (ok disbursement-id)
  )
)

(define-public (process-disbursement (disbursement-id uint))
  (let ((disbursement (unwrap! (get-disbursement disbursement-id) (err ERR-DISBURSEMENT-NOT-FOUND)))
        (institution (unwrap! (get-institution (get institution-id disbursement)) (err ERR-INSTITUTION-NOT-FOUND))))

    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))

    (map-set disbursements
      { disbursement-id: disbursement-id }
      (merge disbursement { status: "completed" })
    )

    (ok true)
  )
)

(define-public (cancel-disbursement (disbursement-id uint))
  (let ((disbursement (unwrap! (get-disbursement disbursement-id) (err ERR-DISBURSEMENT-NOT-FOUND))))
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))

    (map-set disbursements
      { disbursement-id: disbursement-id }
      (merge disbursement { status: "cancelled" })
    )

    (ok true)
  )
)

