# Avatar Photo Picker Fix - TODO

## Plan Breakdown (Approved by user)

**Files to edit:**
- src/components/Avatar.js
- src/services/avatarService.js

**Steps:**
- [x] Step 1: Create TODO.md ✅
- [x] Step 2: Edit Avatar.js 
  - Add bottom safe padding to modalContent ✅
  - Replace Alert.alert in handleRemoveAvatar with Modal trigger ✅
  - Add 'removing' status + trash icon + custom messages in upload modal ✅
  - Fix handleRemoveAvatar to set correct status messages ✅
- [x] Step 3: Edit avatarService.js 
  - Improve deleteAvatar URL parsing with regex fallback ✅
  - Add more console.logs for debugging ✅
- [ ] Step 4: Test modal positioning, remove flow, progress UI
- [x] Step 5: Update TODO.md with completion
- [ ] Step 6: attempt_completion

**Current progress:** Edits complete! Test on device/emulator: ProfileScreen → click avatar → Remove Current Photo. Modal should not overlap nav bar, show removing progress with trash icon, actually delete photo.

