// schedulingRoutes.js
import express from "express";
import authenticateJWT from "../middlewares/authenticateJWT.js";
import roleMiddleware from "../middlewares/roleMiddleware.js";
import SchedulingController from "../controllers/schedulingController.js";
import {
	validateCreateScheduling,
	validateGetAllSchedulings,
	validateGetSchedulingById,
	validateGetSchedulingByDate,
	validateGetSchedulingByEmployee,
	validateUpdateScheduling,
	validateGetAvailableTimeSlots,
} from "../middlewares/validationMiddleware.js";

const router = express.Router();

// get all schedulings
router.get(
	"/",
	authenticateJWT,
	roleMiddleware(["owner", "manager", "employee"]),
	validateGetAllSchedulings,
	(req, res) => SchedulingController.getAllSchedulings(req, res)
);

// get scheduling by id
router.get(
	"/:id",
	authenticateJWT,
	roleMiddleware(["owner", "manager", "employee"]),
	validateGetSchedulingById,
	(req, res) => SchedulingController.getSchedulingById(req, res)
);

// get schedulings by date
router.get(
	"/date/:date",
	authenticateJWT,
	roleMiddleware(["owner", "manager", "employee"]),
	validateGetSchedulingByDate,
	(req, res) => SchedulingController.getSchedulingsByDate(req, res)
);

// get next 5 schedulings
router.get(
	"/next/5",
	authenticateJWT,
	roleMiddleware(["owner", "manager", "employee"]),
	validateGetAllSchedulings,
	(req, res) => SchedulingController.getNextFiveSchedulings(req, res)
);

// get schedulings by employee
router.get(
	"/employee/:employeeId",
	authenticateJWT,
	roleMiddleware(["owner", "manager", "employee"]),
	validateGetSchedulingByEmployee,
	(req, res) => SchedulingController.getSchedulingsByEmployee(req, res)
);

// create scheduling
router.post(
	"/",
	authenticateJWT,
	roleMiddleware(["owner", "manager", "employee"]),
	validateCreateScheduling,
	(req, res) => SchedulingController.createScheduling(req, res)
);

// update scheduling
router.put(
	"/:id",
	authenticateJWT,
	roleMiddleware(["owner", "manager", "employee"]),
	validateUpdateScheduling,
	(req, res) => SchedulingController.updateScheduling(req, res)
);

// delete scheduling
router.delete(
	"/:id",
	authenticateJWT,
	roleMiddleware(["owner", "manager", "employee"]),
	validateGetSchedulingById,
	(req, res) => SchedulingController.deleteScheduling(req, res)
);

// get available time slots for a given date and employee
router.get(
	"/available-slots/:employeeId/:date",
	authenticateJWT,
	roleMiddleware(["owner", "manager", "employee"]),
	validateGetAvailableTimeSlots,
	(req, res) => SchedulingController.getAvailableTimeSlots(req, res)
);
