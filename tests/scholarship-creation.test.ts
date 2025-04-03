import { describe, it, expect, beforeEach } from "vitest"

// Mock clarity functions and environment
const mockClarity = () => {
  const state = {
    contractOwner: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    scholarships: new Map(),
    scholarshipCounter: 0,
  }
  
  return {
    state,
    functions: {
      "get-scholarship": (id) => {
        const scholarship = state.scholarships.get(id)
        return scholarship ? { value: scholarship } : { value: null }
      },
      "get-scholarship-count": () => ({ value: state.scholarshipCounter }),
      "create-scholarship": (name, description, totalAmount, awardAmount, criteriaGpa, criteriaField) => {
        const id = state.scholarshipCounter + 1
        
        // Check authorization
        if (global.txSender !== state.contractOwner) {
          return { type: "err", value: 100 } // ERR-NOT-AUTHORIZED
        }
        
        // Check amount validity
        if (totalAmount < awardAmount) {
          return { type: "err", value: 101 } // ERR-INVALID-AMOUNT
        }
        
        state.scholarships.set(id, {
          name,
          description,
          "total-amount": totalAmount,
          "award-amount": awardAmount,
          "remaining-funds": totalAmount,
          "criteria-gpa": criteriaGpa,
          "criteria-field": criteriaField,
          active: true,
        })
        
        state.scholarshipCounter = id
        return { type: "ok", value: id }
      },
      "fund-scholarship": (scholarshipId, amount) => {
        // Check if scholarship exists
        const scholarship = state.scholarships.get(scholarshipId)
        if (!scholarship) {
          return { type: "err", value: 102 } // ERR-SCHOLARSHIP-NOT-FOUND
        }
        
        // Check authorization
        if (global.txSender !== state.contractOwner) {
          return { type: "err", value: 100 } // ERR-NOT-AUTHORIZED
        }
        
        scholarship["total-amount"] += amount
        scholarship["remaining-funds"] += amount
        state.scholarships.set(scholarshipId, scholarship)
        
        return { type: "ok", value: true }
      },
      "deactivate-scholarship": (scholarshipId) => {
        // Check if scholarship exists
        const scholarship = state.scholarships.get(scholarshipId)
        if (!scholarship) {
          return { type: "err", value: 102 } // ERR-SCHOLARSHIP-NOT-FOUND
        }
        
        // Check authorization
        if (global.txSender !== state.contractOwner) {
          return { type: "err", value: 100 } // ERR-NOT-AUTHORIZED
        }
        
        scholarship.active = false
        state.scholarships.set(scholarshipId, scholarship)
        
        return { type: "ok", value: true }
      },
      "activate-scholarship": (scholarshipId) => {
        // Check if scholarship exists
        const scholarship = state.scholarships.get(scholarshipId)
        if (!scholarship) {
          return { type: "err", value: 102 } // ERR-SCHOLARSHIP-NOT-FOUND
        }
        
        // Check authorization
        if (global.txSender !== state.contractOwner) {
          return { type: "err", value: 100 } // ERR-NOT-AUTHORIZED
        }
        
        scholarship.active = true
        state.scholarships.set(scholarshipId, scholarship)
        
        return { type: "ok", value: true }
      },
    },
  }
}

describe("Scholarship Creation Contract", () => {
  let clarity
  
  // Set up global tx-sender for testing
  global.txSender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
  
  beforeEach(() => {
    clarity = mockClarity()
    global.txSender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM" // Reset to contract owner
  })
  
  describe("create-scholarship", () => {
    it("should create a new scholarship when called by contract owner", () => {
      const result = clarity.functions["create-scholarship"](
          "STEM Scholarship",
          "Scholarship for students in STEM fields",
          100000,
          10000,
          350, // 3.5 GPA
          "Computer Science",
      )
      
      expect(result.type).toBe("ok")
      expect(result.value).toBe(1)
      expect(clarity.state.scholarshipCounter).toBe(1)
      
      const scholarship = clarity.state.scholarships.get(1)
      expect(scholarship.name).toBe("STEM Scholarship")
      expect(scholarship["total-amount"]).toBe(100000)
      expect(scholarship["remaining-funds"]).toBe(100000)
      expect(scholarship.active).toBe(true)
    })
    
    it("should fail when called by non-owner", () => {
      global.txSender = "ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM" // Different address
      
      const result = clarity.functions["create-scholarship"](
          "STEM Scholarship",
          "Scholarship for students in STEM fields",
          100000,
          10000,
          350,
          "Computer Science",
      )
      
      expect(result.type).toBe("err")
      expect(result.value).toBe(100) // ERR-NOT-AUTHORIZED
    })
    
    it("should fail when total amount is less than award amount", () => {
      const result = clarity.functions["create-scholarship"](
          "STEM Scholarship",
          "Scholarship for students in STEM fields",
          5000, // Total amount less than award amount
          10000,
          350,
          "Computer Science",
      )
      
      expect(result.type).toBe("err")
      expect(result.value).toBe(101) // ERR-INVALID-AMOUNT
    })
  })
  
  describe("fund-scholarship", () => {
    it("should add funds to an existing scholarship", () => {
      // First create a scholarship
      clarity.functions["create-scholarship"](
          "Arts Scholarship",
          "Scholarship for arts students",
          50000,
          5000,
          300,
          "Fine Arts",
      )
      
      // Then add funds
      const result = clarity.functions["fund-scholarship"](1, 25000)
      
      expect(result.type).toBe("ok")
      expect(result.value).toBe(true)
      
      const scholarship = clarity.state.scholarships.get(1)
      expect(scholarship["total-amount"]).toBe(75000)
      expect(scholarship["remaining-funds"]).toBe(75000)
    })
    
    it("should fail when scholarship does not exist", () => {
      const result = clarity.functions["fund-scholarship"](999, 10000)
      
      expect(result.type).toBe("err")
      expect(result.value).toBe(102) // ERR-SCHOLARSHIP-NOT-FOUND
    })
  })
  
  describe("deactivate-scholarship and activate-scholarship", () => {
    it("should change the active status of a scholarship", () => {
      // First create a scholarship
      clarity.functions["create-scholarship"](
          "Medical Scholarship",
          "Scholarship for medical students",
          200000,
          20000,
          370,
          "Medicine",
      )
      
      // Deactivate it
      let result = clarity.functions["deactivate-scholarship"](1)
      
      expect(result.type).toBe("ok")
      expect(result.value).toBe(true)
      
      let scholarship = clarity.state.scholarships.get(1)
      expect(scholarship.active).toBe(false)
      
      // Activate it again
      result = clarity.functions["activate-scholarship"](1)
      
      expect(result.type).toBe("ok")
      expect(result.value).toBe(true)
      
      scholarship = clarity.state.scholarships.get(1)
      expect(scholarship.active).toBe(true)
    })
  })
})

