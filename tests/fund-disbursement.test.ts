import { describe, it, expect, beforeEach } from "vitest"

// Mock clarity functions and environment
const mockClarity = () => {
  const state = {
    contractOwner: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    institutions: new Map(),
    disbursements: new Map(),
    institutionCounter: 0,
    disbursementCounter: 0,
  }
  
  return {
    state,
    functions: {
      "get-institution": (id) => {
        const institution = state.institutions.get(id)
        return institution ? { value: institution } : { value: null }
      },
      "get-disbursement": (id) => {
        const disbursement = state.disbursements.get(id)
        return disbursement ? { value: disbursement } : { value: null }
      },
      "get-institution-count": () => ({ value: state.institutionCounter }),
      "get-disbursement-count": () => ({ value: state.disbursementCounter }),
      "register-institution": (name, institutionPrincipal) => {
        const id = state.institutionCounter + 1
        
        // Check authorization
        if (global.txSender !== state.contractOwner) {
          return { type: "err", value: 100 } // ERR-NOT-AUTHORIZED
        }
        
        state.institutions.set(id, {
          name,
          principal: institutionPrincipal,
          verified: true,
        })
        
        state.institutionCounter = id
        return { type: "ok", value: id }
      },
      "create-disbursement": (applicationId, institutionId, amount) => {
        // Check if institution exists
        const institution = state.institutions.get(institutionId)
        if (!institution) {
          return { type: "err", value: 101 } // ERR-INSTITUTION-NOT-FOUND
        }
        
        // Check authorization
        if (global.txSender !== state.contractOwner) {
          return { type: "err", value: 100 } // ERR-NOT-AUTHORIZED
        }
        
        const disbursementId = state.disbursementCounter + 1
        
        state.disbursements.set(disbursementId, {
          "application-id": applicationId,
          "institution-id": institutionId,
          amount,
          status: "pending",
          timestamp: 12345, // Mock block height
        })
        
        state.disbursementCounter = disbursementId
        return { type: "ok", value: disbursementId }
      },
      "process-disbursement": (disbursementId) => {
        // Check if disbursement exists
        const disbursement = state.disbursements.get(disbursementId)
        if (!disbursement) {
          return { type: "err", value: 102 } // ERR-DISBURSEMENT-NOT-FOUND
        }
        
        // Check if institution exists
        const institution = state.institutions.get(disbursement["institution-id"])
        if (!institution) {
          return { type: "err", value: 101 } // ERR-INSTITUTION-NOT-FOUND
        }
        
        // Check authorization
        if (global.txSender !== state.contractOwner) {
          return { type: "err", value: 100 } // ERR-NOT-AUTHORIZED
        }
        
        disbursement.status = "completed"
        state.disbursements.set(disbursementId, disbursement)
        
        return { type: "ok", value: true }
      },
      "cancel-disbursement": (disbursementId) => {
        // Check if disbursement exists
        const disbursement = state.disbursements.get(disbursementId)
        if (!disbursement) {
          return { type: "err", value: 102 } // ERR-DISBURSEMENT-NOT-FOUND
        }
        
        // Check authorization
        if (global.txSender !== state.contractOwner) {
          return { type: "err", value: 100 } // ERR-NOT-AUTHORIZED
        }
        
        disbursement.status = "cancelled"
        state.disbursements.set(disbursementId, disbursement)
        
        return { type: "ok", value: true }
      },
    },
  }
}

describe("Fund Disbursement Contract", () => {
  let clarity
  
  // Set up global tx-sender for testing
  global.txSender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
  
  beforeEach(() => {
    clarity = mockClarity()
    global.txSender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM" // Reset to contract owner
  })
  
  describe("register-institution", () => {
    it("should register a new institution when called by contract owner", () => {
      const result = clarity.functions["register-institution"](
          "State University",
          "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      )
      
      expect(result.type).toBe("ok")
      expect(result.value).toBe(1)
      expect(clarity.state.institutionCounter).toBe(1)
      
      const institution = clarity.state.institutions.get(1)
      expect(institution.name).toBe("State University")
      expect(institution.principal).toBe("ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")
      expect(institution.verified).toBe(true)
    })
    
    it("should fail when called by non-owner", () => {
      global.txSender = "ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM" // Different address
      
      const result = clarity.functions["register-institution"](
          "Tech Institute",
          "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      )
      
      expect(result.type).toBe("err")
      expect(result.value).toBe(100) // ERR-NOT-AUTHORIZED
    })
  })
  
  describe("create-disbursement", () => {
    it("should create a new disbursement for a valid institution", () => {
      // First register an institution
      clarity.functions["register-institution"]("City College", "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")
      
      // Create disbursement
      const result = clarity.functions["create-disbursement"](1, 1, 10000)
      
      expect(result.type).toBe("ok")
      expect(result.value).toBe(1)
      expect(clarity.state.disbursementCounter).toBe(1)
      
      const disbursement = clarity.state.disbursements.get(1)
      expect(disbursement["application-id"]).toBe(1)
      expect(disbursement["institution-id"]).toBe(1)
      expect(disbursement.amount).toBe(10000)
      expect(disbursement.status).toBe("pending")
    })
    
    it("should fail when institution does not exist", () => {
      const result = clarity.functions["create-disbursement"](1, 999, 10000)
      
      expect(result.type).toBe("err")
      expect(result.value).toBe(101) // ERR-INSTITUTION-NOT-FOUND
    })
  })
  
  describe("process-disbursement and cancel-disbursement", () => {
    it("should process a disbursement successfully", () => {
      // First register an institution and create a disbursement
      clarity.functions["register-institution"]("Medical School", "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")
      
      clarity.functions["create-disbursement"](1, 1, 15000)
      
      // Process the disbursement
      const result = clarity.functions["process-disbursement"](1)
      
      expect(result.type).toBe("ok")
      expect(result.value).toBe(true)
      
      const disbursement = clarity.state.disbursements.get(1)
      expect(disbursement.status).toBe("completed")
    })
    
    it("should cancel a disbursement successfully", () => {
      // First register an institution and create a disbursement
      clarity.functions["register-institution"]("Law School", "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")
      
      clarity.functions["create-disbursement"](1, 1, 20000)
      
      // Cancel the disbursement
      const result = clarity.functions["cancel-disbursement"](1)
      
      expect(result.type).toBe("ok")
      expect(result.value).toBe(true)
      
      const disbursement = clarity.state.disbursements.get(1)
      expect(disbursement.status).toBe("cancelled")
    })
  })
})

