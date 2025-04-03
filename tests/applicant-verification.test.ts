import { describe, it, expect, beforeEach } from "vitest"

// Mock clarity functions and environment
const mockClarity = () => {
  const state = {
    contractOwner: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    applicants: new Map(),
    applications: new Map(),
    applicantCounter: 0,
    applicationCounter: 0,
  }
  
  return {
    state,
    functions: {
      "get-applicant": (id) => {
        const applicant = state.applicants.get(id)
        return applicant ? { value: applicant } : { value: null }
      },
      "get-application": (id) => {
        const application = state.applications.get(id)
        return application ? { value: application } : { value: null }
      },
      "get-applicant-count": () => ({ value: state.applicantCounter }),
      "get-application-count": () => ({ value: state.applicationCounter }),
      "register-applicant": (name, institution, gpa, fieldOfStudy) => {
        const id = state.applicantCounter + 1
        
        state.applicants.set(id, {
          principal: global.txSender,
          name,
          institution,
          gpa,
          "field-of-study": fieldOfStudy,
          verified: false,
        })
        
        state.applicantCounter = id
        return { type: "ok", value: id }
      },
      "apply-for-scholarship": (applicantId, scholarshipId) => {
        // Check if applicant exists
        const applicant = state.applicants.get(applicantId)
        if (!applicant) {
          return { type: "err", value: 101 } // ERR-APPLICANT-NOT-FOUND
        }
        
        // Check authorization
        if (global.txSender !== applicant.principal) {
          return { type: "err", value: 100 } // ERR-NOT-AUTHORIZED
        }
        
        const applicationId = state.applicationCounter + 1
        
        state.applications.set(applicationId, {
          "applicant-id": applicantId,
          "scholarship-id": scholarshipId,
          status: "pending",
          timestamp: 12345, // Mock block height
        })
        
        state.applicationCounter = applicationId
        return { type: "ok", value: applicationId }
      },
      "verify-applicant": (applicantId) => {
        // Check if applicant exists
        const applicant = state.applicants.get(applicantId)
        if (!applicant) {
          return { type: "err", value: 101 } // ERR-APPLICANT-NOT-FOUND
        }
        
        // Check authorization
        if (global.txSender !== state.contractOwner) {
          return { type: "err", value: 100 } // ERR-NOT-AUTHORIZED
        }
        
        // Check if already verified
        if (applicant.verified) {
          return { type: "err", value: 103 } // ERR-ALREADY-VERIFIED
        }
        
        applicant.verified = true
        state.applicants.set(applicantId, applicant)
        
        return { type: "ok", value: true }
      },
      "update-application-status": (applicationId, newStatus) => {
        // Check if application exists
        const application = state.applications.get(applicationId)
        if (!application) {
          return { type: "err", value: 102 } // ERR-APPLICATION-NOT-FOUND
        }
        
        // Check authorization
        if (global.txSender !== state.contractOwner) {
          return { type: "err", value: 100 } // ERR-NOT-AUTHORIZED
        }
        
        application.status = newStatus
        state.applications.set(applicationId, application)
        
        return { type: "ok", value: true }
      },
    },
  }
}

describe("Applicant Verification Contract", () => {
  let clarity
  
  // Set up global tx-sender for testing
  global.txSender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
  
  beforeEach(() => {
    clarity = mockClarity()
    global.txSender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM" // Reset to contract owner
  })
  
  describe("register-applicant", () => {
    it("should register a new applicant", () => {
      const result = clarity.functions["register-applicant"](
          "Jane Smith",
          "Tech University",
          380, // 3.8 GPA
          "Computer Science",
      )
      
      expect(result.type).toBe("ok")
      expect(result.value).toBe(1)
      expect(clarity.state.applicantCounter).toBe(1)
      
      const applicant = clarity.state.applicants.get(1)
      expect(applicant.name).toBe("Jane Smith")
      expect(applicant.institution).toBe("Tech University")
      expect(applicant.gpa).toBe(380)
      expect(applicant["field-of-study"]).toBe("Computer Science")
      expect(applicant.verified).toBe(false)
    })
  })
  
  describe("apply-for-scholarship", () => {
    it("should create a new application when called by the applicant", () => {
      // First register an applicant
      const studentAddress = "ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
      global.txSender = studentAddress
      
      clarity.functions["register-applicant"]("John Doe", "State University", 350, "Engineering")
      
      // Apply for scholarship
      const result = clarity.functions["apply-for-scholarship"](1, 5) // Applicant 1, Scholarship 5
      
      expect(result.type).toBe("ok")
      expect(result.value).toBe(1)
      expect(clarity.state.applicationCounter).toBe(1)
      
      const application = clarity.state.applications.get(1)
      expect(application["applicant-id"]).toBe(1)
      expect(application["scholarship-id"]).toBe(5)
      expect(application.status).toBe("pending")
    })
    
    it("should fail when called by someone other than the applicant", () => {
      // First register an applicant
      const studentAddress = "ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
      global.txSender = studentAddress
      
      clarity.functions["register-applicant"]("John Doe", "State University", 350, "Engineering")
      
      // Try to apply with different address
      global.txSender = "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
      const result = clarity.functions["apply-for-scholarship"](1, 5)
      
      expect(result.type).toBe("err")
      expect(result.value).toBe(100) // ERR-NOT-AUTHORIZED
    })
  })
  
  describe("verify-applicant", () => {
    it("should verify an applicant when called by contract owner", () => {
      // First register an applicant
      const studentAddress = "ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
      global.txSender = studentAddress
      
      clarity.functions["register-applicant"]("Maria Garcia", "City College", 390, "Biology")
      
      // Verify as contract owner
      global.txSender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
      const result = clarity.functions["verify-applicant"](1)
      
      expect(result.type).toBe("ok")
      expect(result.value).toBe(true)
      
      const applicant = clarity.state.applicants.get(1)
      expect(applicant.verified).toBe(true)
    })
    
    it("should fail when trying to verify an already verified applicant", () => {
      // First register and verify an applicant
      clarity.functions["register-applicant"]("Alex Johnson", "State University", 370, "Physics")
      
      clarity.functions["verify-applicant"](1)
      
      // Try to verify again
      const result = clarity.functions["verify-applicant"](1)
      
      expect(result.type).toBe("err")
      expect(result.value).toBe(103) // ERR-ALREADY-VERIFIED
    })
  })
  
  describe("update-application-status", () => {
    it("should update the status of an application", () => {
      // First register an applicant and create an application
      const studentAddress = "ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
      global.txSender = studentAddress
      
      clarity.functions["register-applicant"]("Sarah Lee", "Tech Institute", 385, "Computer Science")
      
      clarity.functions["apply-for-scholarship"](1, 3)
      
      // Update status as contract owner
      global.txSender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
      const result = clarity.functions["update-application-status"](1, "approved")
      
      expect(result.type).toBe("ok")
      expect(result.value).toBe(true)
      
      const application = clarity.state.applications.get(1)
      expect(application.status).toBe("approved")
    })
  })
})

