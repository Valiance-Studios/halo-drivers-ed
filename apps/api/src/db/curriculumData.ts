import type {CourseLesson} from '@hde/shared';

/** A lesson's skills, by id. Ids are stored with results, so keep them when rewording a skill. */
type Skills = Record<string, string>;

function course(vehicleSlug: string, lessons: [title: string, skills: Skills][]): CourseLesson[] {
  return lessons.map(([title, skills], index) => ({
    vehicleSlug,
    number: index + 1,
    title,
    skills: Object.entries(skills).map(([id, label]) => ({id, label})),
  }));
}

/**
 * Every course's lessons and the skills marked in each, one lesson per required lesson. Original text, written
 * around how each vehicle works in the Halo universe.
 */
export const CURRICULUM: CourseLesson[] = [
  ...course('mongoose', [
    [
      'Startup and controls',
      {
        walkaround: 'Walk around the quad: tires, suspension and rear seat',
        startEngine: 'Start the engine and let it settle at idle',
        readGauges: 'Read the gauges and confirm vehicle status',
        parkingBrake: 'Engage and release the parking brake',
        throttleAndStop: 'Pull away smoothly and stop on a mark',
      },
    ],
    [
      'Handling with a passenger',
      {
        mountPassenger: 'Seat a passenger and confirm they are holding on',
        tightTurns: 'Take tight turns without lifting a wheel',
        brakeDownhill: 'Control speed down a steep grade',
        jumpLanding: 'Land a small jump level, with the passenger still aboard',
        rightVehicle: 'Right the quad after a rollover',
      },
    ],
  ]),
  ...course('warthog', [
    [
      'Systems and startup',
      {
        inspect: 'Check tires, hull, tow hook and turret mount',
        hydrogenLevels: 'Check the hydrogen level and refill the converter with fresh or salt water',
        startEngine: 'Start the hydrogen engine and read the gauges',
        parkingBrake: 'Engage and release the parking brake',
        driveOff: 'Pull away, steer through a slalom and stop on a mark',
      },
    ],
    [
      'Four-wheel steering',
      {
        tightCircle: 'Hold a tight circle with all four wheels steering',
        handbrakeTurn: 'Turn around with the handbrake',
        looseGround: 'Keep traction on sand, mud and snow',
        hillClimb: 'Climb and descend a steep hill without rolling',
      },
    ],
    [
      'Driving for a gunner',
      {
        crewCheck: 'Confirm the gunner and passenger are aboard before moving',
        holdSteady: 'Hold a steady line while the gunner fires',
        circleTarget: 'Circle a target with the gun on it throughout',
        callouts: 'Call out turns, bumps and targets to the crew',
      },
    ],
    [
      'Recovery and field driving',
      {
        winch: 'Free a stuck Warthog with the winch',
        rollover: 'Dismount and right the Warthog after a rollover',
        waterCrossing: 'Ford shallow water without stalling',
        evade: 'Break away from an ambush with the crew unharmed',
        shutdown: 'Park under cover and shut down in order',
      },
    ],
  ]),
  ...course('scorpion', [
    [
      'Crew station and startup',
      {
        inspect: 'Inspect all four track pods and their treads',
        hatch: 'Enter, seal and open the hatch',
        powerUp: 'Power up the drive and turret systems in order',
        readStatus: 'Read armor, drive and weapon status',
      },
    ],
    [
      'Track driving',
      {
        straightLine: 'Drive a straight line at walking pace',
        pivot: 'Pivot in place both ways',
        obstacles: 'Climb rubble with each track pod following the ground',
        reverse: 'Reverse into cover with a ground guide',
      },
    ],
    [
      'Independent turret',
      {
        traverse: 'Traverse the turret while driving another way',
        barrelClearance: 'Keep the barrel clear of walls and friendly vehicles',
        elevation: 'Adjust the barrel for targets above and below',
        stowTurret: 'Stow the turret facing forward for travel',
      },
    ],
    [
      'Main gun',
      {
        safety: 'Run the range safety check before firing',
        stationaryShot: 'Hit a stationary target from a halt',
        movingShot: 'Hit a stationary target while moving',
        machineGun: 'Switch to the machine gun against light targets',
      },
    ],
    [
      'Working with infantry',
      {
        mirrorCheck: 'Check for riders on the track pods before moving',
        ridersAboard: 'Carry riders at a safe speed, with no sharp pivots',
        clearMuzzle: 'Warn infantry away from the muzzle before firing',
        boarders: 'Respond to an enemy climbing on the hull',
      },
    ],
    [
      'Combat drive',
      {
        hullDown: 'Take a hull-down position',
        frontArmor: 'Keep the front armor toward the threat',
        withdraw: 'Withdraw in reverse while firing',
        convoy: 'Hold position in a convoy with Warthogs',
        shutdown: 'Park, make the gun safe and shut down in order',
      },
    ],
  ]),
  ...course('hornet', [
    [
      'Pre-flight and lift-off',
      {
        preflight: 'Complete the walkaround and pre-flight checklist',
        engines: 'Spool up the engines and check both respond',
        liftOff: 'Lift off vertically and hold a low hover',
        land: 'Set down level on both skids',
      },
    ],
    [
      'Hover and flight control',
      {
        steadyHover: 'Hold a hover over a mark in a crosswind',
        strafe: 'Strafe both ways without gaining or losing height',
        transition: 'Change from hover to forward flight and back',
        terrain: 'Follow terrain at low altitude',
      },
    ],
    [
      'Carrying troops',
      {
        loadSkids: 'Load a soldier on each side and balance the craft',
        smoothFlight: 'Fly a route with riders aboard, without hard banks',
        dropOff: 'Hover for a drop-off within reach of the ground',
        weightChange: 'Correct for the change in weight as riders leave',
      },
    ],
    [
      'Weapons',
      {
        safety: 'Run the weapons safety check',
        autocannon: 'Hit ground targets with the autocannons',
        missiles: 'Choose a target and fire the missile pods',
        strafingRun: 'Complete a strafing run and break away safely',
      },
    ],
    [
      'Evasion and emergencies',
      {
        evade: 'Evade ground fire using cover and altitude; there are no shields',
        damageCheck: 'Assess damage and decide whether to return',
        engineLoss: 'Land after losing an engine',
        roughLanding: 'Land on rough, sloping ground',
      },
    ],
  ]),
  ...course('pelican', [
    [
      'Cockpit and crew',
      {
        walkaround: 'Walk around the craft: engines, wings, ramp and gear',
        crewBrief: 'Brief the co-pilot and crew chief',
        checklist: 'Complete the cockpit checklist aloud with the co-pilot',
        engineStart: 'Start each engine and confirm readings',
      },
    ],
    [
      'Hover control',
      {
        liftOff: 'Lift off vertically with a full troop bay',
        holdHover: 'Hold a hover with vectored thrust',
        pivot: 'Turn in place while hovering',
        land: 'Land on the pad without a bounce',
      },
    ],
    [
      'Flight and navigation',
      {
        transition: 'Change from hover to forward flight',
        waypoints: 'Fly a route of waypoints on time',
        formation: 'Hold formation with another Pelican',
        approach: 'Fly a standard approach and touch down',
      },
    ],
    [
      'Troop transport',
      {
        loadTroops: 'Confirm every passenger is seated and restrained',
        rampControl: 'Open and close the rear ramp with the crew chief',
        lowHover: 'Hover low for troops to leave by the ramp',
        headcount: 'Confirm the headcount before lifting off',
      },
    ],
    [
      'Carrying a vehicle',
      {
        lineUp: 'Hover over a Warthog, lined up for pickup',
        attach: 'Secure the Warthog and confirm it is locked on',
        loadedFlight: 'Fly with the extra weight, without swinging the load',
        lower: 'Lower the Warthog without dropping it',
      },
    ],
    [
      'Hot extraction',
      {
        assess: 'Choose an approach that avoids enemy fire',
        fastApproach: 'Approach fast and stop in a hover on target',
        coverFire: 'Coordinate covering fire with the crew',
        departUnderFire: 'Leave under fire as soon as the headcount is confirmed',
      },
    ],
    [
      'Atmosphere and orbit',
      {
        sealCheck: 'Seal the craft and confirm cabin pressure',
        ascent: 'Climb out of the atmosphere on the planned path',
        docking: 'Dock in a warship hangar',
        reentry: 'Set the angle and speed for re-entry',
      },
    ],
    [
      'Emergencies and check ride',
      {
        engineFailure: 'Keep control after an engine fails',
        fire: 'Respond to a cabin fire with the crew chief',
        crashLanding: 'Brace the crew and make a controlled crash landing',
        checkRide: 'Fly a full mission without instructor help',
      },
    ],
  ]),
  ...course('ghost', [
    [
      'Mounting and hover',
      {
        inspect: 'Inspect the hull, wings and exposed fuel cell',
        mount: 'Mount and bring the drive online',
        hover: 'Hold a steady hover at rest',
        glideAndStop: 'Glide forward and stop on a mark',
        dismount: 'Power down and lock the craft against theft',
      },
    ],
    [
      'Boost and strafe',
      {
        strafe: 'Strafe both ways while facing a target',
        boost: 'Boost in a straight line and recover control',
        boostDiscipline: 'Manage boost so the craft is never caught without it',
        cannons: 'Hit targets with the plasma cannons',
        unevenGround: 'Cross uneven ground without grounding the wings',
      },
    ],
  ]),
  ...course('banshee', [
    [
      'Boarding and lift',
      {
        inspect: 'Inspect the wings, canopy and drive',
        board: 'Take the flying position and close the canopy',
        lift: 'Lift off and hold a low hover',
        land: 'Land level and open the canopy',
      },
    ],
    [
      'Flight control',
      {
        bankedTurns: 'Fly banked turns without losing height',
        climbDive: 'Climb and dive to set altitudes',
        boost: 'Boost and slow again before a marker',
        canyon: 'Fly a canyon course without touching the walls',
      },
    ],
    [
      'Evasion',
      {
        rollLeftRight: 'Evade with rolls to each side',
        flip: 'Flip backward and hold the new heading',
        breakLock: 'Break away from a pursuing missile',
        regainControl: 'Regain control after a forced tumble',
      },
    ],
    [
      'Ground attack',
      {
        plasmaCannons: 'Hit ground targets with the plasma cannons',
        fuelRod: 'Hit a target with the fuel rod cannon from a safe distance',
        attackRun: 'Complete an attack run and climb away',
        boarders: 'Shake off an enemy who boards the craft',
      },
    ],
  ]),
  ...course('wraith', [
    [
      'Command and startup',
      {
        inspect: 'Inspect the hull, hover drive and rear intake',
        seal: 'Enter and seal the command hatch',
        drive: 'Bring the hover drive online',
        steadyHover: 'Hold a level hover on sloping ground',
      },
    ],
    [
      'Maneuvering',
      {
        steer: 'Steer through a narrow course at low speed',
        strafe: 'Strafe from cover to cover',
        boost: 'Boost and stop without striking an obstacle',
        reverse: 'Withdraw in reverse behind cover',
      },
    ],
    [
      'The plasma mortar',
      {
        safety: 'Confirm the impact area is clear of allies',
        range: 'Judge the arc for near and far targets',
        overCover: 'Hit a target hidden behind cover',
        movingTarget: 'Lead a moving target',
      },
    ],
    [
      'Working with a gunner',
      {
        crewCheck: 'Confirm the turret gunner is ready before moving',
        faceThreat: 'Turn the hull so the gunner can reach the threat',
        callouts: 'Call out targets and movements',
        closeDefense: 'Defend against infantry too close for the mortar',
      },
    ],
    [
      'Repelling boarders',
      {
        rearWatch: 'Keep the rear turned away from enemies',
        spotBoarder: 'Notice a boarder before they reach the hatch',
        shakeOff: 'Shake off a boarder with movement and boost',
        abandon: 'Abandon the craft in order when it cannot be saved',
      },
    ],
    [
      'Siege exercise',
      {
        position: 'Choose a firing position with a way out',
        bombard: 'Bombard a marked position and shift fire on command',
        relocate: 'Relocate before the enemy returns fire',
        escort: 'Advance with Ghosts without endangering them',
      },
    ],
  ]),
  ...course('phantom', [
    [
      'Flight deck and lift',
      {
        inspect: 'Inspect the hull, turrets and gravity lift',
        crewStations: 'Confirm every crew station is ready',
        lift: 'Lift off smoothly from a hangar deck',
        land: 'Set down on the hangar deck without a bounce',
      },
    ],
    [
      'Hover and approach',
      {
        steadyHover: 'Hold a hover over a mark',
        sideslip: 'Sideslip between two landing zones',
        turnInPlace: 'Turn in place to face a threat',
        lowApproach: 'Fly a low approach behind terrain',
      },
    ],
    [
      'Gravity lift',
      {
        clearZone: 'Confirm the ground below is clear',
        deploy: 'Deploy troops by the gravity lift',
        recover: 'Recover troops by the gravity lift',
        sideDoors: 'Deploy troops by the side openings',
      },
    ],
    [
      'Turrets and escort',
      {
        fireArcs: 'Turn the craft to give each turret a clear view',
        coverLanding: 'Cover a landing without endangering allies',
        underFire: 'Hold a hover under fire while troops deploy',
        escort: 'Keep position with a Banshee escort',
      },
    ],
    [
      'Carrying a Wraith',
      {
        lineUp: 'Hover lined up over a Wraith',
        attach: 'Secure the Wraith and confirm it is held',
        loadedFlight: 'Fly and turn with the extra weight',
        release: 'Set the Wraith down under control',
      },
    ],
    [
      'Fleet operations',
      {
        launch: 'Launch from a cruiser on command',
        formation: 'Hold formation with two other Phantoms',
        insertion: 'Complete a troop insertion on time',
        dock: 'Return and dock with a moving cruiser',
      },
    ],
  ]),
  ...course('scarab', [
    [
      'Reverence and walkaround',
      {
        sermon: 'Listen to the opening sermon without interrupting',
        walkaround: 'Walk the full length of the platform, deck by deck',
        legs: 'Identify each leg and its joints',
        core: 'Locate the power core and its protective plating',
      },
    ],
    [
      'Directing the colony',
      {
        greet: 'Greet the Lekgolo colony that moves the platform',
        simpleCommands: 'Direct the colony to rise, hold and settle',
        readColony: "Recognize the colony's signs of distress",
        patience: 'Wait for the colony to answer before commanding again',
      },
    ],
    [
      'Standing and balance',
      {
        clearBelow: 'Confirm no one is beneath the legs',
        rise: 'Rise to full height without tilting the deck',
        shiftWeight: 'Shift weight onto any three legs',
        settle: 'Settle to the ground on command',
      },
    ],
    [
      'First steps',
      {
        singleStep: 'Take a single step with each leg',
        walk: 'Walk in a straight line at an even pace',
        halt: 'Halt within one stride',
        mindStep: 'Avoid every marked object on the ground',
      },
    ],
    [
      'Turning and terrain',
      {
        turn: 'Turn in place without crossing legs',
        slope: 'Walk up and down a steep slope',
        rubble: 'Cross rubble and wreckage',
        ledge: 'Step over a ledge while keeping the deck level',
      },
    ],
    [
      'Climbing',
      {
        surveyWall: 'Judge whether a wall can bear the platform',
        grip: 'Place and test each leg before moving the next',
        climb: 'Climb over an obstacle taller than the legs',
        crewSafe: 'Keep the deck crew safe throughout the climb',
      },
    ],
    [
      'Excavation',
      {
        survey: 'Survey a site for buried relics',
        align: 'Align the focus cannon with the dig site',
        cut: 'Cut to a set depth without harming what lies below',
        recover: 'Support the recovery of a relic',
      },
    ],
    [
      'Focus cannon',
      {
        safety: 'Confirm the line of fire is clear of the faithful',
        charge: 'Charge the cannon and hold',
        strike: 'Strike a marked target',
        sweep: 'Sweep the beam across a line of targets',
      },
    ],
    [
      'Defending the platform',
      {
        deckCrew: 'Place the deck crew to guard every approach',
        heavyGuns: 'Direct the heavy plasma guns at attackers',
        repelBoarders: 'Repel boarders from the upper deck',
        guardCore: 'Keep enemies away from the power core',
        protectLegs: 'Respond when a leg is disabled',
      },
    ],
    [
      'Final exam',
      {
        route: 'Walk the exam route without harming an ally',
        obstacles: 'Pass every obstacle on the route',
        targets: 'Strike every exam target',
        evacuate: 'Evacuate the crew in order before a core failure',
        benediction: 'Receive the closing benediction',
      },
    ],
  ]),
];
