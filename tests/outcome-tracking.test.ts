import { describe, it, expect, beforeEach } from "vitest"

// Mock clarity functions and environment
const mockClarity = () => {
  const state = {
    contractOwner: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    academicRecords: new Map(),
    milestones: new Map(),
    recordCounter: 0,
    milestoneCounter: 0,
  }
  
  return {
    state,
    functions: {
      "get-academic-record": (id) => {
        const record = state.academicRecords.get(id)
        return record ? { value: record } : { value: null }
      },
      "get-milestone": (id) => {
        const milestone = state.milestones.get(id)
        return milestone ? { value: milestone } : { value: null }
      },
      "get-record-count": () => ({ value: state.recordCounter }),
      "get-milestone-count": () => ({ value: state.milestoneCounter }),
      "add-academic-record": (applicantId, semester, gpa, creditsCompleted) => {
        const id = state.recordCounter + 1
        
        // Check authorization (contract owner or authorized institution)
        if (global.txSender !== state.contractOwner && !global.isAuthorizedInstitution) {
          return { type: "err", value: 100 } // ERR-NOT-AUTHORIZED
        }
        
        state.academicRecords.set(id, {
          "applicant-id": applicantId,
          semester,
          gpa,
          "credits-completed": creditsCompleted,
          status: "verified",
          timestamp: 12345, // Mock block height
        })
        
        state.recordCounter = id
        return { type: "ok", value: id }
      },
      "add-milestone": (applicantId, description) => {
        const id = state.milestoneCounter + 1
        
        // Check authorization
        if (global.txSender !== state.contractOwner) {
          return { type: "err", value: 100 } // ERR-NOT-AUTHORIZED
        }
        
        state.milestones.set(id, {
          "applicant-id": applicantId,
          description,
          achieved: false,
          timestamp: 12345, // Mock block height
        })
        
        state.milestoneCounter = id
        return { type: "ok", value: id }
      },
      "mark-milestone-achieved": (milestoneId) => {
        // Check if milestone exists
        const milestone = state.milestones.get(milestoneId)
        if (!milestone) {
          return { type: "err", value: 102 } // ERR-MILESTONE-NOT-FOUND
        }
        
        // Check authorization
        if (global.txSender !== state.contractOwner) {
          return { type: "err", value: 100 } // ERR-NOT-AUTHORIZED
        }
        
        milestone.achieved = true
        milestone.timestamp = 12346 // Updated timestamp
        state.milestones.set(milestoneId, milestone)
        
        return { type: "ok", value: true }
      },
      "update-record-status": (recordId, newStatus) => {
        // Check if record exists
        const record = state.academicRecords.get(recordId)
        if (!record) {
          return { type: "err", value: 101 } // ERR-RECORD-NOT-FOUND
        }
        
        // Check authorization
        if (global.txSender !== state.contractOwner) {
          return { type: "err", value: 100 } // ERR-NOT-AUTHORIZED
        }
        
        record.status = newStatus
        state.academicRecords.set(recordId, record)
        
        return { type: "ok", value: true }
      },
    },
  }
}

describe("Outcome Tracking Contract", () => {
  let clarity
  
  // Set up global tx-sender for testing
  global.txSender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
  global.isAuthorizedInstitution = false
  
  beforeEach(() => {
    clarity = mockClarity()
    global.txSender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM" // Reset to contract owner
    global.isAuthorizedInstitution = false
  })
  
  describe("add-academic-record", () => {
    it("should add a new academic record when called by contract owner", () => {
      const result = clarity.functions["add-academic-record"](
          1, // Applicant ID
          "Fall 2023",
          385, // 3.85 GPA
          15, // Credits completed
      )
      
      expect(result.type).toBe("ok")
      expect(result.value).toBe(1)
      expect(clarity.state.recordCounter).toBe(1)
      
      const record = clarity.state.academicRecords.get(1)
      expect(record["applicant-id"]).toBe(1)
      expect(record.semester).toBe("Fall 2023")
      expect(record.gpa).toBe(385)
      expect(record["credits-completed"]).toBe(15)
      expect(record.status).toBe("verified")
    })
    
    it("should add a new academic record when called by authorized institution", () => {
      global.txSender = "ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM" // Different address
      global.isAuthorizedInstitution = true // Mark as authorized institution
      
      const result = clarity.functions["add-academic-record"](1, "Spring 2024", 390, 16)
      
      expect(result.type).toBe("ok")
      expect(result.value).toBe(1)
      
      const record = clarity.state.academicRecords.get(1)
      expect(record.semester).toBe("Spring 2024")
    })
    
    it("should fail when called by unauthorized user", () => {
      global.txSender = "ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM" // Different address
      global.isAuthorizedInstitution = false // Not an authorized institution
      
      const result = clarity.functions["add-academic-record"](1, "Spring 2024", 390, 16)
      
      expect(result.type).toBe("err")
      expect(result.value).toBe(100) // ERR-NOT-AUTHORIZED
    })
  })
  
  describe("add-milestone and mark-milestone-achieved", () => {
    it("should add a new milestone and mark it as achieved", () => {
      // Add milestone
      let result = clarity.functions["add-milestone"](
          1, // Applicant ID
          "Completed first year with honors",
      )
      
      expect(result.type).toBe("ok")
      expect(result.value).toBe(1)
      expect(clarity.state.milestoneCounter).toBe(1)
      
      let milestone = clarity.state.milestones.get(1)
      expect(milestone["applicant-id"]).toBe(1)
      expect(milestone.description).toBe("Completed first year with honors")
      expect(milestone.achieved).toBe(false)
      
      // Mark as achieved
      result = clarity.functions["mark-milestone-achieved"](1)
      
      expect(result.type).toBe("ok")
      expect(result.value).toBe(true)
      
      milestone = clarity.state.milestones.get(1)
      expect(milestone.achieved).toBe(true)
    })
    
    it("should fail to mark non-existent milestone as achieved", () => {
      const result = clarity.functions["mark-milestone-achieved"](999)
      
      expect(result.type).toBe("err")
      expect(result.value).toBe(102) // ERR-MILESTONE-NOT-FOUND
    })
  })
  
  describe("update-record-status", () => {
    it("should update the status of an academic record", () => {
      // First add an academic record
      clarity.functions["add-academic-record"](1, "Fall 2023", 385, 15)
      
      // Update status
      const result = clarity.functions["update-record-status"](1, "reviewed")
      
      expect(result.type).toBe("ok")
      expect(result.value).toBe(true)
      
      const record = clarity.state.academicRecords.get(1)
      expect(record.status).toBe("reviewed")
    })
    
    it("should fail when record does not exist", () => {
      const result = clarity.functions["update-record-status"](999, "reviewed")
      
      expect(result.type).toBe("err")
      expect(result.value).toBe(101) // ERR-RECORD-NOT-FOUND
    })
  })
})

