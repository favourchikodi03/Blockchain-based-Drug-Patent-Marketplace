(define-constant ERR-DUPLICATE_HASH u100)
(define-constant ERR-NOT-AUTHORIZED u101)
(define-constant ERR_INVALID_HASH u102)
(define-constant ERR_INVALID_TITLE u103)
(define-constant ERR_INVALID_DESCRIPTION u104)
(define-constant ERR_INVALID_CATEGORY u105)
(define-constant ERR_PATENT_NOT_FOUND u106)
(define-constant ERR_INVALID_TIMESTAMP u107)
(define-constant ERR_AUTHORITY_NOT_VERIFIED u108)
(define-constant ERR_INVALID_STATUS u109)
(define-constant ERR_INVALID_OWNER u110)
(define-constant ERR_TRANSFER_NOT_ALLOWED u111)
(define-constant ERR_INVALID_UPDATE_PARAM u112)
(define-constant ERR_MAX_PATENTS_EXCEEDED u113)
(define-constant ERR_INVALID_FEE u114)
(define-constant ERR_INVALID_LICENSE_TERM u115)
(define-constant ERR_INVALID_ROYALTY_RATE u116)
(define-constant ERR_INVALID_LOCATION u117)
(define-constant ERR_INVALID_CURRENCY u118)
(define-constant ERR_PATENT_EXPIRED u119)
(define-constant ERR_INVALID_EXPIRATION u120)

(define-data-var next-patent-id uint u0)
(define-data-var max-patents uint u10000)
(define-data-var registration-fee uint u500)
(define-data-var authority-contract (optional principal) none)

(define-map patents
  uint
  {
    hash: (buff 32),
    owner: principal,
    title: (string-utf8 100),
    description: (string-utf8 500),
    category: (string-utf8 50),
    timestamp: uint,
    creator: principal,
    status: bool,
    expiration: uint,
    license-term: uint,
    royalty-rate: uint,
    location: (string-utf8 100),
    currency: (string-utf8 20)
  }
)

(define-map patents-by-hash
  (buff 32)
  uint)

(define-map patents-by-owner
  principal
  (list 100 uint))

(define-map patent-updates
  uint
  {
    update-title: (string-utf8 100),
    update-description: (string-utf8 500),
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-patent (id uint))
  (map-get? patents id)
)

(define-read-only (get-patent-updates (id uint))
  (map-get? patent-updates id)
)

(define-read-only (is-patent-registered (hash (buff 32)))
  (is-some (map-get? patents-by-hash hash))
)

(define-read-only (get-patents-by-owner (owner principal))
  (default-to (list) (map-get? patents-by-owner owner))
)

(define-private (validate-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
      (ok true)
      (err ERR_INVALID_HASH))
)

(define-private (validate-title (title (string-utf8 100)))
  (if (and (> (len title) u0) (<= (len title) u100))
      (ok true)
      (err ERR_INVALID_TITLE))
)

(define-private (validate-description (desc (string-utf8 500)))
  (if (and (> (len desc) u0) (<= (len desc) u500))
      (ok true)
      (err ERR_INVALID_DESCRIPTION))
)

(define-private (validate-category (cat (string-utf8 50)))
  (if (or (is-eq cat "pharma") (is-eq cat "biotech") (is-eq cat "medical"))
      (ok true)
      (err ERR_INVALID_CATEGORY))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR_INVALID_TIMESTAMP))
)

(define-private (validate-status (status bool))
  (ok true)
)

(define-private (validate-expiration (exp uint))
  (if (> exp block-height)
      (ok true)
      (err ERR_INVALID_EXPIRATION))
)

(define-private (validate-license-term (term uint))
  (if (> term u0)
      (ok true)
      (err ERR_INVALID_LICENSE_TERM))
)

(define-private (validate-royalty-rate (rate uint))
  (if (<= rate u50)
      (ok true)
      (err ERR_INVALID_ROYALTY_RATE))
)

(define-private (validate-location (loc (string-utf8 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR_INVALID_LOCATION))
)

(define-private (validate-currency (cur (string-utf8 20)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
      (ok true)
      (err ERR_INVALID_CURRENCY))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR_AUTHORITY_NOT_VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-patents (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR_MAX_PATENTS_EXCEEDED))
    (asserts! (is-some (var-get authority-contract)) (err ERR_AUTHORITY_NOT_VERIFIED))
    (var-set max-patents new-max)
    (ok true)
  )
)

(define-public (set-registration-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR_INVALID_FEE))
    (asserts! (is-some (var-get authority-contract)) (err ERR_AUTHORITY_NOT_VERIFIED))
    (var-set registration-fee new-fee)
    (ok true)
  )
)

(define-public (register-patent
  (hash (buff 32))
  (title (string-utf8 100))
  (description (string-utf8 500))
  (category (string-utf8 50))
  (expiration uint)
  (license-term uint)
  (royalty-rate uint)
  (location (string-utf8 100))
  (currency (string-utf8 20))
)
  (let (
        (next-id (var-get next-patent-id))
        (current-max (var-get max-patents))
        (authority (var-get authority-contract))
        (owner-list (get-patents-by-owner tx-sender))
      )
    (asserts! (< next-id current-max) (err ERR_MAX_PATENTS_EXCEEDED))
    (try! (validate-hash hash))
    (try! (validate-title title))
    (try! (validate-description description))
    (try! (validate-category category))
    (try! (validate-expiration expiration))
    (try! (validate-license-term license-term))
    (try! (validate-royalty-rate royalty-rate))
    (try! (validate-location location))
    (try! (validate-currency currency))
    (asserts! (is-none (map-get? patents-by-hash hash)) (err ERR_DUPLICATE_HASH))
    (let ((authority-recipient (unwrap! authority (err ERR_AUTHORITY_NOT_VERIFIED))))
      (try! (stx-transfer? (var-get registration-fee) tx-sender authority-recipient))
    )
    (map-set patents next-id
      {
        hash: hash,
        owner: tx-sender,
        title: title,
        description: description,
        category: category,
        timestamp: block-height,
        creator: tx-sender,
        status: true,
        expiration: expiration,
        license-term: license-term,
        royalty-rate: royalty-rate,
        location: location,
        currency: currency
      }
    )
    (map-set patents-by-hash hash next-id)
    (map-set patents-by-owner tx-sender (unwrap-panic (as-max-len? (append owner-list next-id) u100)))
    (var-set next-patent-id (+ next-id u1))
    (print { event: "patent-registered", id: next-id })
    (ok next-id)
  )
)

(define-public (update-patent
  (patent-id uint)
  (update-title (string-utf8 100))
  (update-description (string-utf8 500))
)
  (let ((patent (map-get? patents patent-id)))
    (match patent
      p
        (begin
          (asserts! (is-eq (get owner p) tx-sender) (err ERR_NOT-AUTHORIZED))
          (try! (validate-title update-title))
          (try! (validate-description update-description))
          (map-set patents patent-id
            {
              hash: (get hash p),
              owner: (get owner p),
              title: update-title,
              description: update-description,
              category: (get category p),
              timestamp: block-height,
              creator: (get creator p),
              status: (get status p),
              expiration: (get expiration p),
              license-term: (get license-term p),
              royalty-rate: (get royalty-rate p),
              location: (get location p),
              currency: (get currency p)
            }
          )
          (map-set patent-updates patent-id
            {
              update-title: update-title,
              update-description: update-description,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "patent-updated", id: patent-id })
          (ok true)
        )
      (err ERR_PATENT_NOT_FOUND)
    )
  )
)

(define-public (transfer-patent-ownership (patent-id uint) (new-owner principal))
  (let ((patent (map-get? patents patent-id)))
    (match patent
      p
        (begin
          (asserts! (is-eq (get owner p) tx-sender) (err ERR_NOT-AUTHORIZED))
          (try! (validate-principal new-owner))
          (asserts! (get status p) (err ERR_INVALID_STATUS))
          (asserts! (< block-height (get expiration p)) (err ERR_PATENT_EXPIRED))
          (let (
            (old-owner-list (get-patents-by-owner tx-sender))
            (new-owner-list (get-patents-by-owner new-owner))
          )
            (map-set patents-by-owner tx-sender (filter (lambda ((id uint)) (not (is-eq id patent-id))) old-owner-list))
            (map-set patents-by-owner new-owner (unwrap-panic (as-max-len? (append new-owner-list patent-id) u100)))
          )
          (map-set patents patent-id (merge p { owner: new-owner, timestamp: block-height }))
          (print { event: "patent-transferred", id: patent-id, new-owner: new-owner })
          (ok true)
        )
      (err ERR_PATENT_NOT_FOUND)
    )
  )
)

(define-public (verify-patent-ownership (patent-id uint) (claimed-owner principal))
  (let ((patent (map-get? patents patent-id)))
    (match patent
      p
        (if (is-eq (get owner p) claimed-owner)
            (ok true)
            (ok false)
        )
      (err ERR_PATENT_NOT_FOUND)
    )
  )
)

(define-public (get-patent-count)
  (ok (var-get next-patent-id))
)

(define-public (check-patent-existence (hash (buff 32)))
  (ok (is-patent-registered hash))
)